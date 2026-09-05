import type { UnitCode } from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'
import type { CreatedDocument, DocumentSummary } from '../../documents/index.js'

/**
 * Müstahsilden yapılan dört kesintinin ORANLARI (yüzde, 0–100).
 *
 * Portal bunları kalem düzeyinde `v<kod>Orani` alanlarında bekler; kodların
 * karşılıkları için bkz. `ProducerReceiptTax` (`constants`). Verilmeyen bir
 * kesinti sıfır sayılır.
 *
 * @example
 * ```ts
 * import type { ProducerReceiptTaxRates } from '@yankikucuk/efatura'
 *
 * // Yalnızca stopaj ve mera fonu kesiliyor; diğer ikisi 0 sayılır.
 * const rates: ProducerReceiptTaxRates = { incomeTaxWithholding: 2, pastureFund: 1 }
 * console.log(rates.incomeTaxWithholding)
 * ```
 */
export interface ProducerReceiptTaxRates {
  /** `0003` — Gelir Vergisi Stopajı. */
  incomeTaxWithholding?: number
  /** `9040` — Mera Fonu. */
  pastureFund?: number
  /** `8001` — Borsa Tescil Ücreti. */
  stockExchangeRegistration?: number
  /** `SGK_PRIM` — SGK Prim Kesintisi. */
  socialSecurityPremium?: number
}

/**
 * Aynı dört kesintinin hesaplanmış TUTARLARI (lira).
 *
 * Oranlardan farklı olarak dört alanın DÖRDÜ DE her zaman doludur; kesinti
 * uygulanmamışsa değer `0`'dır.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptLineItem, Unit } from '@yankikucuk/efatura'
 * import type { ProducerReceiptTaxAmounts } from '@yankikucuk/efatura'
 *
 * const line = computeProducerReceiptLineItem({
 *   name: 'Buğday',
 *   quantity: 100,
 *   unit: Unit.KILOGRAM,
 *   unitPrice: 12,
 *   taxRates: { incomeTaxWithholding: 2 },
 * })
 * const amounts: ProducerReceiptTaxAmounts = line.taxAmounts
 * console.log(amounts.incomeTaxWithholding, amounts.socialSecurityPremium)
 * ```
 */
export type ProducerReceiptTaxAmounts = Required<ProducerReceiptTaxRates>

/**
 * Bir müstahsil makbuzu kalemi.
 *
 * Kalem tutarı verilmez, HESAPLANIR: tutar = miktar × birim fiyat. Dört
 * kesintinin her biri bu tutarın yüzdesidir ve AYRI AYRI yuvarlanır.
 *
 * @example
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { ProducerReceiptLineItemInput } from '@yankikucuk/efatura'
 *
 * const item: ProducerReceiptLineItemInput = {
 *   name: 'Zeytin',
 *   quantity: 250,
 *   unit: Unit.KILOGRAM,
 *   unitPrice: 40,
 *   taxRates: { incomeTaxWithholding: 4, socialSecurityPremium: 1 },
 * }
 * console.log(item.unit)
 * ```
 */
export interface ProducerReceiptLineItemInput {
  /** `malHizmet` */
  name: string
  /** `miktar` */
  quantity: number
  /** `birim` — UN/ECE Recommendation 20 kodu. */
  unit: UnitCode
  /** `birimFiyat` */
  unitPrice: number
  /** Dört kesintinin oranları; verilmezse tamamı 0 kabul edilir. */
  taxRates?: ProducerReceiptTaxRates
}

/**
 * Bir kalemin hesaplanmış tutarları. Girdi alanlarının tamamını taşır.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptLineItem, Unit } from '@yankikucuk/efatura'
 *
 * const line = computeProducerReceiptLineItem({
 *   name: 'Süt',
 *   quantity: 500,
 *   unit: Unit.LITRE,
 *   unitPrice: 15,
 *   taxRates: { incomeTaxWithholding: 2, pastureFund: 1 },
 * })
 * console.log(line.amount, line.totalTaxes, line.taxAmounts.pastureFund)
 * ```
 */
export interface ComputedProducerReceiptLineItem extends ProducerReceiptLineItemInput {
  /** `malHizmetTutari` — miktar × birim fiyat. */
  amount: number
  /** `v<kod>Tutari` alanlarının karşılığı. */
  taxAmounts: ProducerReceiptTaxAmounts
  /** Dört kesintinin bu kalemdeki toplamı. Portal ayrı bir alanda taşımaz. */
  totalTaxes: number
}

/**
 * Belge düzeyi toplamlar. Tutarların tamamı lira cinsindendir; kuruş
 * dönüşümü mapper içinde yapılır.
 *
 * Faturadan AYRILAN nokta `payableAmount`'tır: burada vergiler eklenmez,
 * KESİLİR — müstahsile ödenecek tutar, vergiler dahil toplamdan dört
 * kesintinin düşülmüş hâlidir.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptTotals, Unit } from '@yankikucuk/efatura'
 * import type { ProducerReceiptTotals } from '@yankikucuk/efatura'
 *
 * const { totals }: { totals: ProducerReceiptTotals } = computeProducerReceiptTotals([
 *   {
 *     name: 'Buğday',
 *     quantity: 100,
 *     unit: Unit.KILOGRAM,
 *     unitPrice: 12,
 *     taxRates: { incomeTaxWithholding: 2 },
 *   },
 * ])
 * // 1200 brüt, 24 stopaj, 1176 ödenecek.
 * console.log(totals.lineTotal, totals.totalTaxes, totals.payableAmount)
 * ```
 */
export interface ProducerReceiptTotals {
  /** `malhizmetToplamTutari` — portalın kendi yazımı, küçük "h". */
  lineTotal: number
  /** `hesaplananv0003`, `hesaplananv9040`, `hesaplananv8001`, `hesaplananvSGK_PRIMTutari`. */
  taxAmounts: ProducerReceiptTaxAmounts
  /** Dört kesintinin toplamı. Portal ayrı bir alanda taşımaz. */
  totalTaxes: number
  /** `vergilerDahilToplamTutar` */
  grandTotal: number
  /** `odenecekTutar` — kesintiler düşüldükten sonra müstahsile ödenecek tutar. */
  payableAmount: number
}

/**
 * Müstahsil (üretici) bilgileri.
 *
 * Portal bu alanları `alici*` önekiyle adlandırır (`vknTckn`, `aliciAdi`,
 * `aliciSoyadi`) ama ekonomik olarak karşı taraf SATICIDIR; kütüphane
 * belgenin adına sadık kalarak `producer` diyor. Müstahsil makbuzunda
 * `unvan` alanı YOKTUR: belge yalnızca gerçek kişiye kesilir.
 *
 * @example
 * ```ts
 * import type { ProducerInput } from '@yankikucuk/efatura'
 *
 * const producer: ProducerInput = {
 *   taxOrIdentityNumber: '11111111111',
 *   firstName: 'Ayşe',
 *   lastName: 'Demir',
 * }
 * console.log(producer.lastName)
 * ```
 */
export interface ProducerInput {
  /** VKN (10 hane) veya TCKN (11 hane). */
  taxOrIdentityNumber: string
  /** `aliciAdi` — müstahsilin adı. Ad ya da soyaddan en az biri zorunludur. */
  firstName?: string
  /** `aliciSoyadi` — müstahsilin soyadı. */
  lastName?: string
}

/**
 * `createProducerReceipt` girdisi.
 *
 * Zorunlu olan yalnızca `producer` ve en az bir `lineItems` kalemidir.
 * Faturadan farklı olarak `totals` override'ı YOKTUR: portal makbuz
 * tutarlarını ne hesaplar ne doğrular, bu yüzden aritmetiğin tek kaynağı bu
 * kütüphanedir ve elle geçersiz kılınmasına izin verilmez.
 *
 * @example
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { ProducerReceiptInput } from '@yankikucuk/efatura'
 *
 * const input: ProducerReceiptInput = {
 *   date: '05/09/2026',
 *   producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
 *   city: 'Konya',
 *   note: 'Eylül alımı',
 *   lineItems: [
 *     {
 *       name: 'Buğday',
 *       quantity: 100,
 *       unit: Unit.KILOGRAM,
 *       unitPrice: 12,
 *       taxRates: { incomeTaxWithholding: 2 },
 *     },
 *   ],
 * }
 * console.log(input.city)
 * ```
 */
export interface ProducerReceiptInput {
  /** `belgeNumarasi` — verilmezse portal atar. */
  documentNumber?: string
  /** Belge tarihi; `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd` metni. Varsayılan bugün. */
  date?: DateInput
  /** Belge saati; `Date` ya da `HH:mm:ss` metni. Varsayılan şu an. */
  time?: DateInput
  /** Müstahsil bilgileri; zorunlu. */
  producer: ProducerInput
  /** `sehir` */
  city?: string
  /** `websitesi` */
  website?: string
  /**
   * `not`
   *
   * DİKKAT: portal bu alanın SONUNA bir satır sonu EKLEYEREK geri döndürür
   * (`"Makbuz notu\n"`). Okuma yolunda tek sondaki satır sonu kırpılır;
   * gidiş-dönüş karşılaştırması yapıyorsanız bunu hesaba katın.
   */
  note?: string
  /** `teslimTarih` — verilmezse belge tarihine düşer. */
  deliveryDate?: DateInput
  /** En az bir kalem; boş dizi doğrulamada reddedilir. */
  lineItems: ProducerReceiptLineItemInput[]
}

/**
 * `EARSIV_PORTAL_MUSTAHSIL_GETIR` sonucu.
 *
 * Tutarlar YENİDEN HESAPLANMAZ: portal hem kalem düzeyinde oranları ve
 * tutarları, hem de belge düzeyinde kesinti toplamlarını döndürür ve kayıtlı
 * olan rakam GİB'in tuttuğu rakamdır.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { ProducerReceiptDetail } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const detail: ProducerReceiptDetail = await client.getProducerReceipt(
 *   '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 * )
 * console.log(detail.deliveryDate, detail.totals.payableAmount, detail.raw.hesaplananv0003)
 * ```
 */
export interface ProducerReceiptDetail {
  /** Portal detay yanıtındaki `uuid`; yoksa istenen ETTN'e düşülür. */
  ettn: string
  /** `belgeNumarasi`; yoksa boş string. */
  documentNumber: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi; ayrıştırılamazsa ham değer. */
  date: string
  /** `HH:mm:ss` biçiminde belge saati; portal vermezse boş string. */
  time: string
  /** Portal yanıtından eşlenmiş müstahsil bilgileri. */
  producer: ProducerInput
  /** `sehir`; yoksa boş string. */
  city: string
  /** `websitesi`; yoksa boş string. */
  website: string
  /** `not` — portalın eklediği tek sondaki satır sonu kırpılmış hâli. */
  note: string
  /** `teslimTarih` — portal ne döndürdüyse ham metin olarak. */
  deliveryDate: string
  /** Kalemler; oranlar ve tutarlar portalın kendi kaydından okunur. */
  lineItems: ComputedProducerReceiptLineItem[]
  /** Belge düzeyi toplamlar; portalın kendi kaydından okunur. */
  totals: ProducerReceiptTotals
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/**
 * `createReceipt` sonucu. Fatura ve serbest meslek makbuzuyla AYNI şekildir:
 * `ettn`, `documentNumber`, `date` ve `approvalStatus`.
 *
 * @example
 * ```ts
 * import { EArsivClient, Unit } from '@yankikucuk/efatura'
 * import type { CreatedProducerReceipt } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created: CreatedProducerReceipt = await client.createProducerReceipt({
 *   producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
 *   lineItems: [{ name: 'Süt', quantity: 100, unit: Unit.LITRE, unitPrice: 15 }],
 * })
 * console.log(created.ettn)
 * ```
 */
export type CreatedProducerReceipt = CreatedDocument

/**
 * Taslak listesinin bir müstahsil makbuzu satırı. `InvoiceSummary` ile aynı
 * şekildir; `documentType` değeri `'MÜSTAHSİL MAKBUZU'` olur.
 *
 * DİKKAT: müstahsil satırlarında portal `aliciUnvanAdSoyad` alanını HİÇ
 * göndermiyor (canlı doğrulandı), yani `buyerName` bu türde boş stringtir.
 *
 * @example
 * ```ts
 * import { DocumentType, EArsivClient } from '@yankikucuk/efatura'
 * import type { ProducerReceiptSummary } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows: ProducerReceiptSummary[] = await client.listProducerReceipts(
 *   new Date(),
 *   new Date(),
 * )
 * console.log(rows.every((row) => row.documentType === DocumentType.PRODUCER_RECEIPT))
 * ```
 */
export type ProducerReceiptSummary = DocumentSummary
