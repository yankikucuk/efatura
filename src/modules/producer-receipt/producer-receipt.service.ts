import { Command, DocumentType, InvoiceListKind, PageName } from '../../constants/index.js'
import { type DateInput, formatPortalDate } from '../../core/index.js'
import {
  asRows,
  filterByDocumentType,
  resolveCreatedEttn,
  toDocumentSummary,
} from '../../documents/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { toPortalProducerReceipt, toProducerReceiptDetail } from './producer-receipt.mapper.js'
import type {
  CreatedProducerReceipt,
  ProducerReceiptDetail,
  ProducerReceiptInput,
  ProducerReceiptSummary,
} from './producer-receipt.types.js'
import { validateProducerReceiptInput } from './producer-receipt.validator.js'

/** Müstahsil makbuzu oluşturma, listeleme ve okuma işlemleri. */
export class ProducerReceiptService {
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * `createReceipt` çağrılarını bu örnek üzerinde SERİLEŞTİREN dahili zincir.
   *
   * Gerekçesi `InvoiceService.pending` ile aynıdır (mlevent#101): anlık
   * görüntü-farkı tasarımı, aynı örnek üzerinden gelen eşzamanlı iki çağrıda
   * ikisinin de aynı "önce" görüntüsünü görmesi yüzünden HER İKİSİNİ birden
   * `EArsivAmbiguousResultError` ile reddederdi — oysa portalda iki makbuz da
   * gerçekten oluşmuş olurdu. Müstahsil makbuzunda risk daha da yüksektir:
   * aynı üreticiye aynı gün art arda makbuz kesmek olağandır.
   *
   * Süreçler-arası eşzamanlılık bu zincirle ÇÖZÜLMEZ; belgelenmiş sınırdır.
   * Zincir KENDİSİ asla reddetmez, aksi halde bir hata sonraki tüm çağrıları
   * kalıcı olarak düşürürdü.
   */
  private pending: Promise<unknown> = Promise.resolve()

  /**
   * Taslak müstahsil makbuzu oluşturur ve atanan ETTN'i çözer.
   *
   * Portal oluşturma yanıtında yalnızca bir durum cümlesi döndürür; ETTN'i
   * kendisi atar ve istemcinin gönderdiğini yok sayar. Bu yüzden oluşturmadan
   * önce ve sonra taslak listesi alınıp fark hesaplanır. Fark tekile inmezse
   * tahmin yerine `EArsivAmbiguousResultError` fırlatılır.
   */
  async createReceipt(input: ProducerReceiptInput): Promise<CreatedProducerReceipt> {
    // Doğrulama kuyruğa girmeden ÖNCE çalışır: geçersiz bir girdi, başka bir
    // çağrının ağ turunu beklemeden hemen reddedilir.
    validateProducerReceiptInput(input)

    const run = this.pending.then(() => this.createReceiptLocked(input))
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async createReceiptLocked(input: ProducerReceiptInput): Promise<CreatedProducerReceipt> {
    const date = formatPortalDate(input.date)
    const before = new Set((await this.listReceipts(date, date)).map((row) => row.ettn))

    await this.gateway.call<string>(
      Command.CREATE_PRODUCER_RECEIPT,
      PageName.PRODUCER_RECEIPT,
      toPortalProducerReceipt(input),
    )

    const after = await this.listReceipts(date, date)
    const created = resolveCreatedEttn({
      before,
      after,
      hint: {
        buyerTaxOrIdentityNumber: input.producer.taxOrIdentityNumber,
        // Müstahsil satırlarında `aliciUnvanAdSoyad` alanı HİÇ YOK (canlı
        // doğrulandı) — özet bu alanı '' üretir ve resolver boş adı ayırt
        // edici saymaz. İpucu yine de doldurulur: portal ileride alanı
        // eklerse daraltma kendiliğinden çalışsın.
        buyerName: `${input.producer.firstName ?? ''} ${input.producer.lastName ?? ''}`.trim(),
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
   * Belirtilen tarih aralığındaki müstahsil makbuzlarını listeler.
   *
   * Portal makbuzlar için AYRI bir listeleme komutu sunmuyor: fatura ile
   * aynı `EARSIV_PORTAL_TASLAKLARI_GETIR` kullanılır ve `hangiTip: 'Buyuk'`
   * bir belge türü filtresi DEĞİL, bir ÜST KÜMEDİR (fatura + iki makbuz).
   * Bu yüzden sonuç `belgeTuru` ile süzülür.
   */
  async listReceipts(from: DateInput, to: DateInput): Promise<ProducerReceiptSummary[]> {
    const data = await this.gateway.call<unknown>(Command.LIST_INVOICES, PageName.DRAFTS, {
      baslangic: formatPortalDate(from),
      bitis: formatPortalDate(to),
      hangiTip: InvoiceListKind.STANDARD,
    })
    return filterByDocumentType(asRows(data).map(toDocumentSummary), DocumentType.PRODUCER_RECEIPT)
  }

  /** Tek bir müstahsil makbuzunun tam detayını getirir. */
  async getReceipt(ettn: string): Promise<ProducerReceiptDetail> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_PRODUCER_RECEIPT,
      PageName.PRODUCER_RECEIPT,
      { ettn },
    )
    return toProducerReceiptDetail(raw, ettn)
  }
}
