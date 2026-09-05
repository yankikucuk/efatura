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

/**
 * Müstahsil makbuzu oluşturma, listeleme ve okuma işlemleri.
 *
 * Belge SİLME yoktur: portalın silme komutu test ortamında hiçbir belge
 * türünde çalışmadığı için makbuzlara açılmadı.
 *
 * DİKKAT: portal makbuz tutarlarını NE HESAPLAR NE DOĞRULAR (canlı
 * doğrulandı: kasıtlı yanlış bir `odenecekTutar` aynen saklandı). Bu yüzden
 * `totals` override'ı bilinçli olarak AÇILMAMIŞTIR — aritmetiğin tek
 * güvencesi bu kütüphanedir.
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   HttpClient,
 *   ProducerReceiptService,
 *   resolveClientOptions,
 * } from 'efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const receipts = new ProducerReceiptService(new DispatchGateway(http, auth))
 * console.log((await receipts.listReceipts(new Date(), new Date())).length)
 * ```
 */
export class ProducerReceiptService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
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
   *
   * ÜÇ portal isteği yapar: listele → oluştur → yeniden listele. Aynı örnek
   * üzerindeki eşzamanlı çağrılar sıraya alınır.
   *
   * @param input Makbuz girdisi; zorunlu alanlar `producer` (VKN/TCKN ve ad
   *   ya da soyad) ve en az bir `lineItems` kalemidir. `deliveryDate`
   *   verilmezse belge tarihine düşer. Bkz. {@link ProducerReceiptInput}.
   * @returns Oluşan makbuzun `ettn`, `documentNumber`, `date` ve
   *   `approvalStatus` alanları.
   * @throws {EArsivValidationError} Girdi doğrulaması başarısızsa — kontrol
   *   KUYRUĞA GİRMEDEN önce çalışır ve ağa hiç çıkılmaz.
   * @throws {EArsivAmbiguousResultError} Makbuz oluşturuldu ancak ETTN tekil
   *   olarak belirlenemedi.
   * @throws {EArsivApiError} Portal oluşturmayı reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient, Unit } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const created = await client.createProducerReceipt({
   *   producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
   *   city: 'Konya',
   *   lineItems: [
   *     {
   *       name: 'Buğday',
   *       quantity: 100,
   *       unit: Unit.KILOGRAM,
   *       unitPrice: 12,
   *       taxRates: { incomeTaxWithholding: 2 },
   *     },
   *   ],
   * })
   * console.log(created.ettn)
   * ```
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
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Yalnızca `documentType === 'MÜSTAHSİL MAKBUZU'` olan satırlar;
   *   kayıt yoksa boş dizi. DİKKAT: portal bu satırlarda `aliciUnvanAdSoyad`
   *   alanını hiç göndermiyor, yani `buyerName` boş stringtir.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const rows = await client.listProducerReceipts('01/09/2026', '30/09/2026')
   * console.log(rows.map((row) => row.documentNumber))
   * ```
   */
  async listReceipts(from: DateInput, to: DateInput): Promise<ProducerReceiptSummary[]> {
    const data = await this.gateway.call<unknown>(Command.LIST_INVOICES, PageName.DRAFTS, {
      baslangic: formatPortalDate(from),
      bitis: formatPortalDate(to),
      hangiTip: InvoiceListKind.STANDARD,
    })
    return filterByDocumentType(asRows(data).map(toDocumentSummary), DocumentType.PRODUCER_RECEIPT)
  }

  /**
   * Tek bir müstahsil makbuzunun tam detayını getirir.
   *
   * Tutarlar YENİDEN HESAPLANMAZ; portalın kendi kaydı okunur.
   *
   * @param ettn Makbuzun ETTN'i; liste satırından dönen değerle birebir aynı
   *   olmalıdır.
   * @returns Eşlenmiş detay. Kimlik alanı portal yanıtındaki `uuid`'dir;
   *   bulunamazsa istenen ETTN'e düşülür. `note` alanının sonundaki, portalın
   *   eklediği tek satır sonu kırpılmıştır.
   * @throws {EArsivApiError} ETTN bulunamazsa veya portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const detail = await client.getProducerReceipt('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * console.log(detail.totals.payableAmount, detail.note, detail.deliveryDate)
   * ```
   */
  async getReceipt(ettn: string): Promise<ProducerReceiptDetail> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_PRODUCER_RECEIPT,
      PageName.PRODUCER_RECEIPT,
      { ettn },
    )
    return toProducerReceiptDetail(raw, ettn)
  }
}
