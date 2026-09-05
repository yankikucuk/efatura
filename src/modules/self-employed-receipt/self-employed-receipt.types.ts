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
  address?: AddressInput
}

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
   */
  vatWithholdingRate?: number
}

/**
 * Bir kalemin hesaplanmış tutarları.
 *
 * `withholdingAmount`, `vatAmount` ve `vatWithholdingAmount` portalın
 * DÖNDÜRMEDİĞİ alanlardır (detay yanıtında yalnızca oranlar gelir); bu
 * yüzden okuma yolunda da oranlardan yeniden hesaplanırlar.
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

/** Belge düzeyi toplamlar; tamamı lira cinsindendir. */
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

export interface SelfEmployedReceiptInput {
  documentNumber?: string
  date?: DateInput
  time?: DateInput
  /** `paraBirimi` — varsayılan TRY. */
  currency?: CurrencyCode
  /** `kur` — TRY dışı para birimlerinde zorunlu. */
  currencyRate?: number
  payer: SelfEmployedPayerInput
  /** `aciklama` */
  description?: string
  /** `kdvTahakkukIcin` — makbuzun yalnızca KDV tahakkuku için düzenlendiğini bildirir. */
  forVatAccrual?: boolean
  lineItems: SelfEmployedReceiptLineItemInput[]
}

/** `EARSIV_PORTAL_SERBEST_MESLEK_GETIR` sonucu. */
export interface SelfEmployedReceiptDetail {
  ettn: string
  documentNumber: string
  date: string
  time: string
  currency: string
  currencyRate: number
  payer: SelfEmployedPayerInput
  description: string
  forVatAccrual: boolean
  lineItems: ComputedSelfEmployedReceiptLineItem[]
  totals: SelfEmployedReceiptTotals
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/** `createReceipt` sonucu. */
export type CreatedSelfEmployedReceipt = CreatedDocument

/** Taslak listesinin bir serbest meslek makbuzu satırı. */
export type SelfEmployedReceiptSummary = DocumentSummary
