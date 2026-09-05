import { Command, DocumentType, InvoiceListKind, PageName } from '../../constants/index.js'
import { type DateInput, EArsivPortalDefectError, formatPortalDate } from '../../core/index.js'
import {
  asRows,
  filterByDocumentType,
  resolveCreatedEttn,
  toDocumentSummary,
} from '../../documents/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import {
  toPortalSelfEmployedReceipt,
  toSelfEmployedReceiptDetail,
} from './self-employed-receipt.mapper.js'
import type {
  CreatedSelfEmployedReceipt,
  SelfEmployedReceiptDetail,
  SelfEmployedReceiptInput,
  SelfEmployedReceiptSummary,
} from './self-employed-receipt.types.js'
import { validateSelfEmployedReceiptInput } from './self-employed-receipt.validator.js'

/** Portalın SMM gösteriminde sızdırdığı Java istisnası — kusurun kanıtı. */
const PORTAL_DEFECT_MESSAGE = 'String index out of range: 4'

/**
 * SMM'nin HTML gösterimi/PDF'e çevrilmesi için tek tip hata üretir.
 *
 * Mesaj kasıtlı olarak uzun: kullanıcının ilk refleksi "ben mi yanlış
 * kullandım?" olur ve bu soruya harcanacak zamanı burada bitirmek gerekir.
 * Bu yüzden metin (a) kusurun portalda olduğunu, (b) portalın kendi hata
 * metnini, (c) bizim tarafımızda denenmiş ve başarısız olmuş varyantları,
 * (d) müstahsilin AYNI komutla çalıştığını ve (e) çalışan alternatifi
 * söyler.
 */
export function selfEmployedReceiptHtmlUnsupported(ettn: string): EArsivPortalDefectError {
  return new EArsivPortalDefectError(
    'Serbest Meslek Makbuzunun HTML gösterimi e-Arşiv portalında BOZUK; bu bir kullanım ' +
      `hatası değildir ve istemci tarafında düzeltilemez. Portal, geçerli bir SMM ETTN'i ile ` +
      `(${ettn}) çağrılan ${Command.SHOW_INVOICE} komutuna sızdırılmış bir Java istisnasıyla ` +
      `yanıt veriyor: "${PORTAL_DEFECT_MESSAGE}" (canlı doğrulandı 2026-09-05). Denenen ve ` +
      'hepsi aynı hatayı veren varyantlar: pageName RG_SERBEST ve RG_TASLAKLAR, ek belgeTuru ' +
      'alanı, liste ETTN’i, detay ETTN’i ve belge numarası; alternatif komut adları ' +
      '(EARSIV_PORTAL_SERBEST_MESLEK_GOSTER, EARSIV_PORTAL_MAKBUZ_GOSTER) portalda mevcut ' +
      'değil. Aynı komut Müstahsil Makbuzunda sorunsuz çalışıyor, yani kusur SMM’ye özgüdür. ' +
      'Makbuzun tüm verilerine getSelfEmployedReceipt(ettn) ile erişebilirsiniz.',
    { command: Command.SHOW_INVOICE, portalMessage: PORTAL_DEFECT_MESSAGE },
  )
}

/** Serbest meslek makbuzu oluşturma, listeleme ve okuma işlemleri. */
export class SelfEmployedReceiptService {
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * `createReceipt` çağrılarını bu örnek üzerinde SERİLEŞTİREN dahili zincir;
   * gerekçesi `InvoiceService.pending` ile aynıdır (mlevent#101). Zincirin
   * kendisi asla reddetmez.
   */
  private pending: Promise<unknown> = Promise.resolve()

  /**
   * Taslak serbest meslek makbuzu oluşturur ve atanan ETTN'i çözer.
   *
   * Portal ETTN'i kendisi atar ve istemcinin gönderdiğini yok sayar; kimlik
   * bu yüzden anlık görüntü farkıyla çözülür ve fark tekile inmezse
   * tahmin yerine `EArsivAmbiguousResultError` fırlatılır.
   */
  async createReceipt(input: SelfEmployedReceiptInput): Promise<CreatedSelfEmployedReceipt> {
    validateSelfEmployedReceiptInput(input)

    const run = this.pending.then(() => this.createReceiptLocked(input))
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async createReceiptLocked(
    input: SelfEmployedReceiptInput,
  ): Promise<CreatedSelfEmployedReceipt> {
    const date = formatPortalDate(input.date)
    const before = new Set((await this.listReceipts(date, date)).map((row) => row.ettn))

    await this.gateway.call<string>(
      Command.CREATE_SELF_EMPLOYED_RECEIPT,
      PageName.SELF_EMPLOYED_RECEIPT,
      toPortalSelfEmployedReceipt(input),
    )

    const after = await this.listReceipts(date, date)
    const created = resolveCreatedEttn({
      before,
      after,
      hint: {
        buyerTaxOrIdentityNumber: input.payer.taxOrIdentityNumber,
        // Liste satırındaki `aliciUnvanAdSoyad` alanı SMM'de `adi` + `soyadi`
        // birleşimidir — `unvan` DEĞİL (canlı doğrulandı: yalnızca ünvan
        // verildiğinde alan boş döndü). İpucunu ünvandan üretmek daraltmayı
        // sessizce bozardı.
        buyerName: `${input.payer.firstName ?? ''} ${input.payer.lastName ?? ''}`.trim(),
        date,
      },
    })

    return {
      ettn: created.ettn,
      documentNumber: created.documentNumber,
      date: created.date,
      approvalStatus: created.approvalStatus,
    }
  }

  /**
   * Belirtilen tarih aralığındaki serbest meslek makbuzlarını listeler.
   *
   * Fatura ile aynı komut kullanılır; `hangiTip: 'Buyuk'` bir belge türü
   * filtresi DEĞİL, bir ÜST KÜMEDİR, bu yüzden sonuç `belgeTuru` ile
   * süzülür.
   */
  async listReceipts(from: DateInput, to: DateInput): Promise<SelfEmployedReceiptSummary[]> {
    const data = await this.gateway.call<unknown>(Command.LIST_INVOICES, PageName.DRAFTS, {
      baslangic: formatPortalDate(from),
      bitis: formatPortalDate(to),
      hangiTip: InvoiceListKind.STANDARD,
    })
    return filterByDocumentType(
      asRows(data).map(toDocumentSummary),
      DocumentType.SELF_EMPLOYED_RECEIPT,
    )
  }

  /** Tek bir serbest meslek makbuzunun tam detayını getirir. */
  async getReceipt(ettn: string): Promise<SelfEmployedReceiptDetail> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_SELF_EMPLOYED_RECEIPT,
      PageName.SELF_EMPLOYED_RECEIPT,
      { ettn },
    )
    return toSelfEmployedReceiptDetail(raw, ettn)
  }

  /**
   * HTML gösterimi DESTEKLENMEZ — portal kusuru. Her zaman
   * `EArsivPortalDefectError` fırlatır; ağa hiç çıkılmaz, çünkü çıkılsaydı
   * kullanıcı ham Java istisnasını görürdü.
   */
  getHtml(ettn: string): never {
    throw selfEmployedReceiptHtmlUnsupported(ettn)
  }

  /** PDF, HTML gösterimi üzerine kurulu olduğu için o da desteklenmez. */
  toPdf(ettn: string): never {
    throw selfEmployedReceiptHtmlUnsupported(ettn)
  }
}
