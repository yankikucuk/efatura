import type { CurrencyCode } from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'
import type { AddressInput, CreatedDocument, DocumentSummary } from '../../documents/index.js'

/**
 * Makbuzun düzenlendiği taraf — hizmeti alan ve ücreti ödeyen.
 *
 * Portal bu alanları önekSİZ adlandırır (`unvan`, `adi`, `soyadi`), ancak
 * taslak listesinde `aliciUnvanAdSoyad` olarak görünürler. Faturadan farklı
 * olarak `unvan` gerçekten kullanılabilir: serbest meslek makbuzu tüzel
 * kişiye de düzenlenir.
 *
 * DİKKAT: liste satırındaki `aliciUnvanAdSoyad` alanı `adi` + `soyadi`
 * birleşimidir, `unvan` DEĞİL — yalnızca ünvan verildiğinde alan boş döner
 * (canlı doğrulandı 2026-09-05).
 *
 * @example Tüzel kişi
 * ```ts
 * import type { SelfEmployedPayerInput } from 'efatura'
 *
 * const payer: SelfEmployedPayerInput = {
 *   taxOrIdentityNumber: '1111111111',
 *   title: 'ÖRNEK A.Ş.',
 *   taxOffice: 'Kadıköy',
 * }
 * console.log(payer.title)
 * ```
 *
 * @example Gerçek kişi ve adres
 * ```ts
 * import { Country } from 'efatura'
 * import type { SelfEmployedPayerInput } from 'efatura'
 *
 * const payer: SelfEmployedPayerInput = {
 *   taxOrIdentityNumber: '11111111111',
 *   firstName: 'Ali',
 *   lastName: 'Yılmaz',
 *   address: { country: Country.TURKIYE, city: 'İstanbul' },
 * }
 * console.log(payer.address?.city)
 * ```
 */
export interface SelfEmployedPayerInput {
  /** VKN (10 hane) veya TCKN (11 hane). */
  taxOrIdentityNumber: string
  /** `unvan` — tüzel kişi ünvanı. */
  title?: string
  /** `adi` */
  firstName?: string
  /** `soyadi` */
  lastName?: string
  /** `vergiDairesi` */
  taxOffice?: string
  /**
   * Adres alanları. DİKKAT: portal SMM'de cadde anahtarını faturadakinden
   * FARKLI yazıyor (`bulvarCaddeSokak`, faturada tamamı küçük
   * `bulvarcaddesokak`); eşleme bunu kendisi halleder.
   */
  address?: AddressInput
}

/**
 * Bir serbest meslek makbuzu kalemi.
 *
 * Türetilmiş tutarların HİÇBİRİ girdi olarak verilmez; oranlardan hesaplanır.
 * En kritik kural KDV matrahıdır: KDV BRÜT ücret üzerinden hesaplanır, net
 * ücret üzerinden DEĞİL. Net üzerinden hesaplamak stopajın KDV matrahını da
 * düşürmesi demek olurdu; mevzuata aykırıdır ve her makbuzda sessiz bir
 * eksik KDV üretirdi.
 *
 * @example
 * ```ts
 * import type { SelfEmployedReceiptLineItemInput } from 'efatura'
 *
 * const item: SelfEmployedReceiptLineItemInput = {
 *   description: 'Mali müşavirlik hizmeti',
 *   grossFee: 10_000,
 *   vatRate: 20,
 *   withholdingRate: 20,
 *   // Mevzuattaki 5/10 kesri yüzdeye çevrilir.
 *   vatWithholdingRate: 50,
 * }
 * console.log(item.grossFee)
 * ```
 */
export interface SelfEmployedReceiptLineItemInput {
  /** `neIcinAlindigi` — ücretin ne için alındığı. */
  description: string
  /** `brutUcret` */
  grossFee: number
  /** `kdv` — KDV oranı, yüzde 0–100. */
  vatRate: number
  /** `stopaj` — gelir vergisi stopaj oranı, yüzde 0–100. Varsayılan 0. */
  withholdingRate?: number
  /**
   * `kdvTevkifatOrani` — KDV tevkifat oranı, YÜZDE olarak (0–100).
   *
   * Mevzuatta bu oran kesir biçiminde anılır (ör. 5/10); portal alanı bir
   * sayı beklediği için kütüphane yüzdeye çevirmiş hâlini alır: 5/10 → 50.
   * Varsayılan 0 (tevkifat yok).
   *
   * DÜRÜST KALAN RİSK: portal bu alanın BİRİMİNİ doğrulamıyor — `50`
   * gönderildiğinde `50`, `5` gönderildiğinde `5` olarak saklıyor. Yani
   * yüzde seçimi bu kütüphanenin sözleşmesidir, portalın teyidi değildir.
   */
  vatWithholdingRate?: number
}

/**
 * Bir kalemin hesaplanmış tutarları.
 *
 * `withholdingAmount`, `vatAmount` ve `vatWithholdingAmount` portalın
 * DÖNDÜRMEDİĞİ alanlardır (detay yanıtında yalnızca oranlar gelir); bu
 * yüzden okuma yolunda da oranlardan yeniden hesaplanırlar.
 *
 * @example
 * ```ts
 * import { computeSelfEmployedReceiptLineItem } from 'efatura'
 *
 * const line = computeSelfEmployedReceiptLineItem({
 *   description: 'Danışmanlık',
 *   grossFee: 10_000,
 *   vatRate: 20,
 *   withholdingRate: 20,
 *   vatWithholdingRate: 50,
 * })
 * // 2000 stopaj, 8000 net ücret, 2000 KDV (BRÜT üzerinden), 1000 tevkifat,
 * // 1000 tahsil edilen KDV, 9000 net alınan.
 * console.log(line.withholdingAmount, line.netFee, line.vatAmount, line.netReceived)
 * ```
 */
export interface ComputedSelfEmployedReceiptLineItem extends SelfEmployedReceiptLineItemInput {
  /** Gelir vergisi stopajı = brüt ücret × stopaj oranı. */
  withholdingAmount: number
  /** `netUcret` = brüt ücret − stopaj. */
  netFee: number
  /** KDV = BRÜT ücret × KDV oranı. KDV matrahı net ücret DEĞİLDİR. */
  vatAmount: number
  /** KDV tevkifatı = KDV tutarı × tevkifat oranı. */
  vatWithholdingAmount: number
  /** Tahsil edilen KDV = KDV − KDV tevkifatı. */
  collectedVat: number
  /** `netAlinan` = net ücret + tahsil edilen KDV. */
  netReceived: number
}

/**
 * Belge düzeyi toplamlar; tamamı lira cinsindendir.
 *
 * Yedi alanın her biri kalem değerlerinin kuruş üzerinden toplamıdır; okuma
 * yolunda ise portalın kendi kaydından okunur.
 *
 * @example
 * ```ts
 * import { computeSelfEmployedReceiptTotals } from 'efatura'
 * import type { SelfEmployedReceiptTotals } from 'efatura'
 *
 * const { totals }: { totals: SelfEmployedReceiptTotals } = computeSelfEmployedReceiptTotals([
 *   { description: 'Danışmanlık', grossFee: 10_000, vatRate: 20, withholdingRate: 20 },
 * ])
 * console.log(totals.grossFee, totals.withholding, totals.netFee, totals.netReceived)
 * ```
 */
export interface SelfEmployedReceiptTotals {
  /** `brtUcret` */
  grossFee: number
  /** `gvStpjTtari` */
  withholding: number
  /** `netUcretTtr` */
  netFee: number
  /** `kdvTtri` */
  vat: number
  /** `kdvTvkftTtri` */
  vatWithholding: number
  /** `thsilEdilenKdv` */
  collectedVat: number
  /** `netAlinanToplam` */
  netReceived: number
}

/**
 * `createSelfEmployedReceipt` girdisi.
 *
 * Zorunlu olan yalnızca `payer` ve en az bir `lineItems` kalemidir.
 * Müstahsil makbuzunda olduğu gibi `totals` override'ı YOKTUR: portal
 * hesaplamıyor ve doğrulamıyor, gönderilmeyen türetilmiş alanı 0 olarak
 * saklıyor — aritmetiğin tek güvencesi bu kütüphanedir.
 *
 * @example
 * ```ts
 * import type { SelfEmployedReceiptInput } from 'efatura'
 *
 * const input: SelfEmployedReceiptInput = {
 *   date: '05/09/2026',
 *   payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
 *   description: 'Eylül 2026 danışmanlık',
 *   lineItems: [
 *     { description: 'Mali müşavirlik', grossFee: 10_000, vatRate: 20, withholdingRate: 20 },
 *   ],
 * }
 * console.log(input.description)
 * ```
 *
 * @example Dövizli makbuz — `currencyRate` zorunlu
 * ```ts
 * import { Currency } from 'efatura'
 * import type { SelfEmployedReceiptInput } from 'efatura'
 *
 * const input: SelfEmployedReceiptInput = {
 *   currency: Currency.US_DOLLAR,
 *   currencyRate: 41.15,
 *   payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK LLC' },
 *   lineItems: [{ description: 'Consulting', grossFee: 2_500, vatRate: 0 }],
 * }
 * console.log(input.currency)
 * ```
 */
export interface SelfEmployedReceiptInput {
  /** `belgeNumarasi` — verilmezse portal atar. */
  documentNumber?: string
  /** Belge tarihi; `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd` metni. Varsayılan bugün. */
  date?: DateInput
  /** Belge saati; `Date` ya da `HH:mm:ss` metni. Varsayılan şu an. */
  time?: DateInput
  /** `paraBirimi` — varsayılan TRY. */
  currency?: CurrencyCode
  /** `kur` — TRY dışı para birimlerinde zorunlu. */
  currencyRate?: number
  /** Makbuzun düzenlendiği taraf; zorunlu. */
  payer: SelfEmployedPayerInput
  /** `aciklama` */
  description?: string
  /** `kdvTahakkukIcin` — makbuzun yalnızca KDV tahakkuku için düzenlendiğini bildirir. */
  forVatAccrual?: boolean
  /** En az bir kalem; boş dizi doğrulamada reddedilir. */
  lineItems: SelfEmployedReceiptLineItemInput[]
}

/**
 * `EARSIV_PORTAL_SERBEST_MESLEK_GETIR` sonucu.
 *
 * KALEM tutarları oranlardan YENİDEN HESAPLANIR (portal türetilmiş tutarları
 * döndürmez); BELGE düzeyi toplamlar portalın kendi kaydından okunur.
 * Portalın sakladığı ham değerlere `raw` üzerinden erişilir.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { SelfEmployedReceiptDetail } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const detail: SelfEmployedReceiptDetail = await client.getSelfEmployedReceipt(
 *   '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 * )
 * console.log(detail.forVatAccrual, detail.totals.netReceived, detail.raw.netAlinanToplam)
 * ```
 */
export interface SelfEmployedReceiptDetail {
  /** Portal detay yanıtındaki `ettn`; yoksa istenen ETTN'e düşülür. */
  ettn: string
  /** `belgeNumarasi`; yoksa boş string. */
  documentNumber: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi; ayrıştırılamazsa ham değer. */
  date: string
  /** `HH:mm:ss` biçiminde belge saati; portal vermezse boş string. */
  time: string
  /** ISO 4217 kodu; portal vermezse `'TRY'`. */
  currency: string
  /** `kur`; portal vermezse 0. */
  currencyRate: number
  /** Portal yanıtından eşlenmiş ödeyen tarafın bilgileri. */
  payer: SelfEmployedPayerInput
  /** `aciklama`; yoksa boş string. */
  description: string
  /** `kdvTahakkukIcin` — portal bu alanı boolean saklar ve boolean döndürür. */
  forVatAccrual: boolean
  /** Kalemler; türetilmiş tutarlar oranlardan yeniden hesaplanır. */
  lineItems: ComputedSelfEmployedReceiptLineItem[]
  /** Belge düzeyi toplamlar; portalın kendi kaydından okunur. */
  totals: SelfEmployedReceiptTotals
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/**
 * `createReceipt` sonucu. Fatura ve müstahsil makbuzuyla AYNI şekildir:
 * `ettn`, `documentNumber`, `date` ve `approvalStatus`.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { CreatedSelfEmployedReceipt } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created: CreatedSelfEmployedReceipt = await client.createSelfEmployedReceipt({
 *   payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ description: 'Danışmanlık', grossFee: 5_000, vatRate: 20 }],
 * })
 * console.log(created.documentNumber)
 * ```
 */
export type CreatedSelfEmployedReceipt = CreatedDocument

/**
 * Taslak listesinin bir serbest meslek makbuzu satırı. `InvoiceSummary` ile
 * aynı şekildir; `documentType` değeri `'SERBEST MESLEK MAKBUZU'` olur.
 *
 * @example
 * ```ts
 * import { DocumentType, EArsivClient } from 'efatura'
 * import type { SelfEmployedReceiptSummary } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows: SelfEmployedReceiptSummary[] = await client.listSelfEmployedReceipts(
 *   new Date(),
 *   new Date(),
 * )
 * console.log(rows.every((row) => row.documentType === DocumentType.SELF_EMPLOYED_RECEIPT))
 * ```
 */
export type SelfEmployedReceiptSummary = DocumentSummary
