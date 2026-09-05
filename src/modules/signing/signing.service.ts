import { Command, DocumentType, PageName } from '../../constants/index.js'
import { EArsivApiError, EArsivValidationError } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import type { SendSmsOptions, SmsChallenge, VerifySmsInput } from './signing.types.js'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * SMS ile fatura imzalama.
 *
 * Test ortamı bu komutlara yetki vermiyor; akış yalnızca gerçek hesapla
 * çalışır (spec §2.5).
 */
export class SigningService {
  constructor(private readonly gateway: DispatchGateway) {}

  /** Portalda kayıtlı cep telefonu numarası. */
  async getPhoneNumber(): Promise<string> {
    const data = await this.gateway.call<Record<string, unknown>>(
      Command.QUERY_PHONE,
      PageName.INTERACTIVE_DRAFTS,
      {},
    )
    return str(data.telefon)
  }

  /** Doğrulama kodu gönderir ve işlem kimliğini döndürür. */
  async sendSmsCode(options: SendSmsOptions = {}): Promise<SmsChallenge> {
    const phoneNumber = options.phoneNumber ?? (await this.getPhoneNumber())

    const data = await this.gateway.call<Record<string, unknown>>(
      Command.SEND_SMS_CODE,
      PageName.SMS_APPROVAL,
      { CEPTEL: phoneNumber, KCEPTEL: false, TIP: '' },
    )

    const operationId = str(data.oid)
    if (operationId.length === 0) {
      throw new EArsivApiError('Portal SMS işlem kimliği (oid) döndürmedi.', {
        command: Command.SEND_SMS_CODE,
        callId: 'sendSmsCode',
        raw: data,
      })
    }
    return { operationId, phoneNumber }
  }

  /**
   * Kodu doğrular ve faturaları imzalar.
   *
   * Portal başarıyı `data.sonuc` alanında `"1"` olarak bildirir. Spec §4
   * her başarısız işlemin bir hata fırlatması gerektiğini söylüyor;
   * `boolean` döndürmek çağıranın dönüş değerini yoksayıp faturalarının
   * imzalandığına inanmasına izin verirdi (bkz. I8). `sonuc` `String()` ile
   * zorlanır: spec §2.5 bu akışın test ortamında hiç doğrulanamadığını
   * söylüyor, yani portalın `"1"` yerine SAYISAL `1` döndürme ihtimali
   * kanıtlanmamıştı — `str()` (yalnızca string/number'ı kabul eden, sayıyı
   * `String()`'e çeviren o yardımcı DEĞİL, burada tanımsız/null için `''`
   * döndüren özel bir coercion) her iki biçimi de kabul eder.
   */
  async verifySmsCode(input: VerifySmsInput): Promise<void> {
    if (input.invoices.length === 0) {
      throw new EArsivValidationError('İmzalamak için en az bir fatura verilmeli.', [
        { path: 'invoices', message: 'Liste boş.' },
      ])
    }

    const data = await this.gateway.call<Record<string, unknown>>(
      Command.VERIFY_SMS_CODE,
      PageName.SMS_APPROVAL,
      {
        SIFRE: input.code,
        OID: input.operationId,
        OPR: 1,
        DATA: input.invoices.map((invoice) => ({
          belgeNumarasi: invoice.documentNumber,
          aliciVknTckn: invoice.buyerTaxOrIdentityNumber,
          aliciUnvanAdSoyad: invoice.buyerName,
          belgeTarihi: invoice.date,
          belgeTuru: DocumentType.INVOICE,
          ettn: invoice.ettn,
          onayDurumu: invoice.approvalStatus,
        })),
      },
    )

    const rawSonuc = data.sonuc
    const sonuc =
      typeof rawSonuc === 'string' || typeof rawSonuc === 'number' ? String(rawSonuc) : ''
    if (sonuc !== '1') {
      throw new EArsivApiError('SMS doğrulama kodu reddedildi veya faturalar imzalanamadı.', {
        command: Command.VERIFY_SMS_CODE,
        callId: 'verifySmsCode',
        raw: data,
      })
    }
  }
}
