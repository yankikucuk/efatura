import { Command, DocumentType, PageName } from '../../constants/index.js'
import { EArsivApiError, EArsivValidationError } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import type { SendSmsOptions, SmsChallenge, VerifySmsInput } from './signing.types.js'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * SMS ile fatura imzalama.
 *
 * Test ortamı bu komutlara yetki vermiyor; akış yalnızca gerçek hesapla
 * çalışır (spec §2.5). Test ortamında portal "Bu işlem için yetkiniz yok"
 * döndürür ve bu KALICI bir izin kısıtlamasıdır — bayat token değildir.
 *
 * Akış üç adımdır: `getPhoneNumber()` (opsiyonel) → `sendSmsCode()` →
 * `verifySmsCode()`.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'production' })
 * await client.login({ username: '1111111111', password: 'gizli' })
 *
 * const challenge = await client.sendSmsCode()
 * const drafts = await client.listDrafts(new Date(), new Date())
 * await client.verifySmsCode({
 *   code: '123456',
 *   operationId: challenge.operationId,
 *   invoices: drafts,
 * })
 * ```
 */
export class SigningService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * Portalda kayıtlı cep telefonu numarası.
   *
   * @returns Kayıtlı numara; portal alanı boş bırakırsa boş string.
   * @throws {EArsivApiError} Portal komutu reddederse — TEST ortamında
   *   beklenen durum budur.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi gerçekten dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   * console.log(await client.getPhoneNumber())
   * ```
   */
  async getPhoneNumber(): Promise<string> {
    const data = await this.gateway.call<Record<string, unknown>>(
      Command.QUERY_PHONE,
      PageName.INTERACTIVE_DRAFTS,
      {},
    )
    return str(data.telefon)
  }

  /**
   * Doğrulama kodu gönderir ve işlem kimliğini döndürür.
   *
   * @param options `phoneNumber` verilmezse portaldan kayıtlı numara ayrıca
   *   sorgulanır — bu, fazladan BİR portal isteği demektir.
   * @returns `operationId` (doğrulama adımına aynen geri verilir) ve kodun
   *   gönderildiği `phoneNumber`.
   * @throws {EArsivApiError} Portal işlem kimliği (`oid`) döndürmezse veya
   *   komutu reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   *
   * // Numarayı biliyorsanız fazladan sorguyu atlayın.
   * const challenge = await client.sendSmsCode({ phoneNumber: '5551112233' })
   * console.log(challenge.operationId)
   * ```
   */
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
   *
   * @param input `code` SMS ile gelen doğrulama kodu, `operationId`
   *   `sendSmsCode` sonucundaki kimlik, `invoices` imzalanacak faturaların
   *   ÖZET SATIRLARI (listeleme yöntemlerinden dönen nesneler doğrudan
   *   verilebilir). Liste BOŞ OLAMAZ.
   * @returns İmzalama tamamlandığında çözülen söz. Dönüş değeri YOKTUR:
   *   çağrı dönerse imzalama gerçekleşmiştir.
   * @throws {EArsivValidationError} `invoices` boşsa — ağa hiç çıkılmaz.
   * @throws {EArsivApiError} Kod reddedilirse veya portal `sonuc` alanında
   *   `"1"` dışında bir değer döndürürse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivApiError, EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   *
   * const challenge = await client.sendSmsCode()
   * try {
   *   await client.verifySmsCode({
   *     code: '123456',
   *     operationId: challenge.operationId,
   *     invoices: await client.listDrafts(new Date(), new Date()),
   *   })
   *   console.log('İmzalandı.')
   * } catch (error) {
   *   if (error instanceof EArsivApiError) console.error('Kod reddedildi:', error.message)
   * }
   * ```
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
