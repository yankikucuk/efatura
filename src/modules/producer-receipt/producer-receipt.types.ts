import type { UnitCode } from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'
import type { CreatedDocument, DocumentSummary } from '../../documents/index.js'

/**
 * Müstahsilden yapılan dört kesintinin ORANLARI (yüzde, 0–100).
 *
 * Portal bunları kalem düzeyinde `v<kod>Orani` alanlarında bekler; kodların
 * karşılıkları için bkz. `ProducerReceiptTax` (`constants`). Verilmeyen bir
 * kesinti sıfır sayılır.
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

/** Aynı dört kesintinin hesaplanmış TUTARLARI (lira). */
export type ProducerReceiptTaxAmounts = Required<ProducerReceiptTaxRates>

export interface ProducerReceiptLineItemInput {
  /** `malHizmet` */
  name: string
  /** `miktar` */
  quantity: number
  /** `birim` — UN/ECE Recommendation 20 kodu. */
  unit: UnitCode
  /** `birimFiyat` */
  unitPrice: number
  taxRates?: ProducerReceiptTaxRates
}

/** Bir kalemin hesaplanmış tutarları. */
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
 */
export interface ProducerInput {
  /** VKN (10 hane) veya TCKN (11 hane). */
  taxOrIdentityNumber: string
  firstName?: string
  lastName?: string
}

export interface ProducerReceiptInput {
  documentNumber?: string
  date?: DateInput
  time?: DateInput
  producer: ProducerInput
  /** `sehir` */
  city?: string
  /** `websitesi` */
  website?: string
  /** `not` */
  note?: string
  /** `teslimTarih` — verilmezse belge tarihine düşer. */
  deliveryDate?: DateInput
  lineItems: ProducerReceiptLineItemInput[]
}

/** `EARSIV_PORTAL_MUSTAHSIL_GETIR` sonucu. */
export interface ProducerReceiptDetail {
  ettn: string
  documentNumber: string
  date: string
  time: string
  producer: ProducerInput
  city: string
  website: string
  note: string
  deliveryDate: string
  lineItems: ComputedProducerReceiptLineItem[]
  totals: ProducerReceiptTotals
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/** `createReceipt` sonucu. */
export type CreatedProducerReceipt = CreatedDocument

/** Taslak listesinin bir müstahsil makbuzu satırı. */
export type ProducerReceiptSummary = DocumentSummary
