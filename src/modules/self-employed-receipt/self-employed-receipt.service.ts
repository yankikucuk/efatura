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
 * (d) müstahsilin AYNI komutla çalıştığını ve (e) çalışan alternatifleri
 * söyler.
 *
 * (e) 2026-09-05'te GENİŞLEDİ ve kısıt önemli ölçüde YUMUŞADI: mesaj eskiden
 * yalnızca `getSelfEmployedReceipt(ettn)` diyordu, yani kullanıcıya "veriye
 * erişebilirsin ama basılabilir belgeye erişemezsin" diye okunuyordu. Oysa
 * indirme uç noktası `belgeTip='SERBEST MESLEK MAKBUZU'` ile doğrudan resmî
 * bir PDF döndürüyor (canlı doğrulandı). Bozuk olan yalnızca HTML
 * GÖSTERİMİDİR; basılabilir belge yolu AÇIKTIR ve mesaj bunu göstermek
 * zorundadır — aksi halde çıktıya ihtiyacı olan kullanıcı, var olan yolu
 * bilmeden PDF'i kendi üretmeye kalkardı.
 *
 * Hatayı FIRLATMAZ, yalnızca ÜRETİR — çağıran `throw` eder. Bu, aynı mesajın
 * hem `getHtml` hem `toPdf` yolunda birebir aynı olmasını sağlar.
 *
 * @param ettn Kullanıcının verdiği ETTN; mesajın içinde yankılanır. Hiçbir
 *   istekte KULLANILMAZ ve doğrulanmaz.
 * @returns Fırlatılmaya hazır `EArsivPortalDefectError`; `command` alanı
 *   `EARSIV_PORTAL_FATURA_GOSTER`, `portalMessage` alanı portalın kendi Java
 *   istisna metnidir. Mesaj İKİ çalışan yolu adıyla gösterir:
 *   `getSelfEmployedReceipt` (veri) ve `downloadSelfEmployedReceiptPdf`
 *   (basılabilir resmî PDF).
 *
 * @example
 * ```ts
 * import { selfEmployedReceiptHtmlUnsupported } from '@yankikucuk/efatura'
 *
 * const error = selfEmployedReceiptHtmlUnsupported('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * console.log(error.kind, error.portalMessage)
 * // 'portal-defect' 'String index out of range: 4'
 * console.log(error.message.includes('downloadSelfEmployedReceiptPdf')) // true
 * ```
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
      'BOZUK OLAN YALNIZCA HTML GÖSTERİMİDİR; makbuza iki yoldan erişmeye devam ' +
      'edebilirsiniz: (1) tüm verileri için getSelfEmployedReceipt(ettn); ' +
      '(2) BASILABİLİR RESMİ BELGE için downloadSelfEmployedReceiptPdf(ettn) — portal ' +
      'SMM indirmesinde ZIP paketi değil, doğrudan PDF döndürüyor (canlı doğrulandı ' +
      '2026-09-05). Yani bu kısıt sizi resmî çıktıdan MAHRUM BIRAKMAZ.',
    { command: Command.SHOW_INVOICE, portalMessage: PORTAL_DEFECT_MESSAGE },
  )
}

/**
 * Serbest meslek makbuzu oluşturma, listeleme ve okuma işlemleri.
 *
 * HTML gösterimi ve HTML'den PDF üretimi DESTEKLENMEZ: portal kusuru
 * nedeniyle `getHtml` ve `toPdf` her zaman `EArsivPortalDefectError` fırlatır
 * ve ağa hiç çıkmaz. Belge SİLME de yoktur.
 *
 * Bu, basılabilir belgeye hiç erişilemediği anlamına GELMEZ: indirme uç
 * noktası SMM için doğrudan resmî PDF döndürüyor — bkz.
 * `EArsivClient.downloadSelfEmployedReceiptPdf` (canlı doğrulandı
 * 2026-09-05). Kısıt yalnızca portalın HTML GÖSTERİMİNİ kapsar.
 *
 * Tutar zincirinin tamamı bu kütüphanede hesaplanır — portal hiçbirini
 * hesaplamaz ve gönderilmeyen türetilmiş alanı 0 olarak saklar.
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   HttpClient,
 *   resolveClientOptions,
 *   SelfEmployedReceiptService,
 * } from '@yankikucuk/efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const receipts = new SelfEmployedReceiptService(new DispatchGateway(http, auth))
 * console.log((await receipts.listReceipts(new Date(), new Date())).length)
 * ```
 */
export class SelfEmployedReceiptService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
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
   *
   * ÜÇ portal isteği yapar: listele → oluştur → yeniden listele. Aynı örnek
   * üzerindeki eşzamanlı çağrılar sıraya alınır.
   *
   * @param input Makbuz girdisi; zorunlu alanlar `payer` (VKN/TCKN ve ünvan
   *   ya da ad/soyad) ve en az bir `lineItems` kalemidir. `currency`
   *   varsayılan `'TRY'`; TRY dışında `currencyRate` zorunludur.
   *   `vatWithholdingRate` YÜZDE olarak verilir (5/10 → `50`). Bkz.
   *   {@link SelfEmployedReceiptInput}.
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
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const created = await client.createSelfEmployedReceipt({
   *   payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
   *   description: 'Eylül 2026 danışmanlık',
   *   lineItems: [
   *     { description: 'Mali müşavirlik', grossFee: 10_000, vatRate: 20, withholdingRate: 20 },
   *   ],
   * })
   * console.log(created.ettn)
   * ```
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
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Yalnızca `documentType === 'SERBEST MESLEK MAKBUZU'` olan
   *   satırlar; kayıt yoksa boş dizi. DİKKAT: satırın `buyerName` alanı
   *   `adi` + `soyadi` birleşimidir — yalnızca ünvan verilmiş bir makbuzda
   *   BOŞ döner.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const rows = await client.listSelfEmployedReceipts('01/09/2026', '30/09/2026')
   * console.log(rows.map((row) => row.ettn))
   * ```
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

  /**
   * Tek bir serbest meslek makbuzunun tam detayını getirir.
   *
   * KALEM tutarları oranlardan YENİDEN HESAPLANIR: portal türetilmiş kalem
   * tutarlarını hiç döndürmez ve `netUcret`/`netAlinan` alanları portalın
   * hesabı değil, oluşturma sırasında gönderilenin yankısıdır. BELGE düzeyi
   * toplamlar ise portalın kendi kaydından okunur.
   *
   * @param ettn Makbuzun ETTN'i; liste satırından dönen değerle birebir aynı
   *   olmalıdır.
   * @returns Eşlenmiş detay. Kimlik alanı portal yanıtındaki `ettn`'dir;
   *   bulunamazsa istenen ETTN'e düşülür.
   * @throws {EArsivApiError} ETTN bulunamazsa veya portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const detail = await client.getSelfEmployedReceipt('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * console.log(detail.totals.netReceived, detail.lineItems[0]?.vatAmount, detail.raw.netUcretTtr)
   * ```
   */
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
   *
   * Basılabilir resmî belge için `EArsivClient.downloadSelfEmployedReceiptPdf`
   * kullanın; portal SMM indirmesinde doğrudan PDF döndürür. Hata mesajı bu
   * yolu da adıyla söyler.
   *
   * @param ettn Makbuzun ETTN'i; yalnızca hata mesajında yankılanır.
   * @returns Hiçbir zaman dönmez (`never`).
   * @throws {EArsivPortalDefectError} HER ZAMAN.
   *
   * @example
   * ```ts
   * import { EArsivClient, EArsivPortalDefectError } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   *
   * try {
   *   client.getSelfEmployedReceiptHtml(ettn)
   * } catch (error) {
   *   console.log(error instanceof EArsivPortalDefectError) // true
   * }
   * ```
   */
  getHtml(ettn: string): never {
    throw selfEmployedReceiptHtmlUnsupported(ettn)
  }

  /**
   * Bu metodun ürettiği PDF, HTML gösterimi üzerine kurulu olduğu için
   * desteklenmez. Portalın KENDİ resmî PDF'i bundan farklıdır ve
   * erişilebilir: `EArsivClient.downloadSelfEmployedReceiptPdf`.
   *
   * @param ettn Makbuzun ETTN'i; yalnızca hata mesajında yankılanır.
   * @returns Hiçbir zaman dönmez (`never`).
   * @throws {EArsivPortalDefectError} HER ZAMAN; `getHtml` ile birebir aynı
   *   mesaj ve bağlam.
   *
   * @example
   * ```ts
   * import { EArsivClient, EArsivPortalDefectError } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   *
   * try {
   *   client.selfEmployedReceiptToPdf('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * } catch (error) {
   *   console.log(error instanceof EArsivPortalDefectError) // true
   * }
   * ```
   */
  toPdf(ettn: string): never {
    throw selfEmployedReceiptHtmlUnsupported(ettn)
  }
}
