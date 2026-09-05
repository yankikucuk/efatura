import type {
  ApprovalStatusValue,
  CurrencyCode,
  DocumentTypeCode,
  InvoiceListKindValue,
  InvoiceTypeCode,
  UnitCode,
} from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'
import type { AddressInput, CreatedDocument, DocumentSummary } from '../../documents/index.js'

/**
 * Adres girdisi `documents` yaprak katmanına taşındı (serbest meslek
 * makbuzu da aynı alanları taşıyor); adı geriye dönük uyumluluk için
 * buradan yeniden dışa açılıyor.
 */
export type { AddressInput }

export interface ContactInput {
  phone?: string
  fax?: string
  email?: string
  website?: string
}

export interface BuyerInput {
  /** VKN (10 hane) veya TCKN (11 hane). */
  taxOrIdentityNumber: string
  /** Tüzel kişi ünvanı. Gerçek kişide firstName/lastName kullanılır. */
  title?: string
  firstName?: string
  lastName?: string
  taxOffice?: string
  address?: AddressInput
  contact?: ContactInput
}

export interface LineItemInput {
  name: string
  quantity: number
  unit: UnitCode
  unitPrice: number
  /** Yüzde, 0–100. */
  discountRate?: number
  discountReason?: string
  /** Yüzde, 0–100. Ör. 20, 10, 1, 0. */
  vatRate: number
  /** Yüzde, 0–100. Portal `vergiOrani` alanı. */
  additionalTaxRate?: number
}

export interface ReceiptInput {
  number?: string
  date?: DateInput
  time?: string
  type?: string
  zReportNumber?: string
  cashRegisterSerialNumber?: string
}

export interface SpecialBaseInput {
  amount?: number
  /** Yüzde, 0–100. */
  rate?: number
  taxAmount?: number
  taxType?: string
}

/** Tutarların tamamı lira cinsindendir; kuruş dönüşümü mapper içinde yapılır. */
export interface InvoiceTotals {
  /** `malhizmetToplamTutari` — iskonto öncesi kalem toplamı. */
  lineTotal: number
  /** `toplamIskonto` */
  totalDiscount: number
  /** `matrah` — iskonto sonrası vergi matrahı. */
  taxBase: number
  /** `hesaplanankdv` */
  calculatedVat: number
  /**
   * `vergilerToplami` içindeki KDV dışı vergiler.
   *
   * Portal bu alanı ayrı taşımıyor; modelde tutuluyor çünkü onsuz
   * `totalTaxes` iki bilinmeyenli tek denklem olur ve `calculatedVat`
   * override'ı hiçbir eşitlikle doğrulanamazdı.
   */
  additionalTaxes: number
  /** `vergilerToplami` — KDV ve varsa ek vergiler. */
  totalTaxes: number
  /** `vergilerDahilToplamTutar` */
  grandTotal: number
  /** `odenecekTutar` */
  payableAmount: number
}

/** Bir kalemin hesaplanmış tutarları. */
export interface ComputedLineItem extends LineItemInput {
  /** `fiyat` — miktar × birim fiyat, iskonto öncesi. */
  grossAmount: number
  /** `iskontoTutari` */
  discountAmount: number
  /** `malHizmetTutari` — iskonto sonrası. */
  netAmount: number
  /** `kdvTutari` */
  vatAmount: number
  /** `vergininKdvTutari` */
  additionalTaxAmount: number
}

export interface InvoiceInput {
  documentNumber?: string
  date?: DateInput
  time?: DateInput
  currency?: CurrencyCode
  /** TRY dışı para birimlerinde zorunlu. */
  currencyRate?: number
  invoiceType?: InvoiceTypeCode
  buyer: BuyerInput
  lineItems: LineItemInput[]
  /** Verilirse hesaplanan değerlerin üzerine yazılır ve tutarlılık doğrulanır. */
  totals?: Partial<InvoiceTotals>
  note?: string
  orderNumber?: string
  orderDate?: DateInput
  waybillNumber?: string
  waybillDate?: DateInput
  receipt?: ReceiptInput
  specialBase?: SpecialBaseInput
}

/**
 * Taslak listesinin bir satırı.
 *
 * `DocumentSummary` olarak `src/documents/`'a taşındı (portal-belge-geneli:
 * yalnızca faturaya özgü değil). Bu takma ad geriye dönük uyumluluk için
 * korunuyor — `InvoiceSummary` public API'nin bir parçası (bkz. `src/index.ts`).
 */
export type InvoiceSummary = DocumentSummary

/** `EARSIV_PORTAL_FATURA_GETIR` sonucu. */
export interface InvoiceDetail {
  ettn: string
  documentNumber: string
  date: string
  time: string
  currency: string
  currencyRate: number
  invoiceType: string
  buyer: BuyerInput
  lineItems: ComputedLineItem[]
  totals: InvoiceTotals
  note: string
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/**
 * `createDraft` sonucu.
 *
 * `CreatedDocument` olarak `documents` katmanına taşındı — fatura ve her iki
 * makbuz türü aynı şekli döndürüyor. Bu takma ad public API'nin parçası
 * olarak korunuyor.
 */
export type CreatedInvoice = CreatedDocument

export interface ListOptions {
  /** Varsayılan `InvoiceListKind.INTERACTIVE`. */
  kind?: InvoiceListKindValue
}

/**
 * `listIncomingExternal` filtreleri — portalın kendi ekranında üçü de
 * opsiyoneldir; boş bırakılan alan "filtre yok" anlamına gelir.
 */
export interface ListIncomingExternalFilters {
  sellerTaxOrIdentityNumber?: string
  documentType?: DocumentTypeCode
  invoiceNumber?: string
}

/**
 * "Portal Harici Adıma Düzenlenen Belgeler" satırı — bir ENTEGRATÖR
 * aracılığıyla adınıza düzenlenmiş belge. `InvoiceSummary`'den farklı: satıcı
 * kimliği taşır (bu listede siz her zaman alıcısınız) ve entegratörün verdiği
 * ayrı bir fatura numarası (`invoiceNumber`) içerir.
 *
 * NOT: alan adları portalın filtre alanlarıyla (`saticiVknTckn`, `belgeTuru`,
 * `faturaNo`) ve diğer belge listelerindeki (`belgeNumarasi`, `belgeTarihi`,
 * `onayDurumu`) tutarlı adlandırma kuralından çıkarıldı; canlı test
 * ortamındaki paylaşımlı test kullanıcısında gerçek bir entegratör kaydı
 * gözlemlenemedi (bkz. rapor). Gerçek bir yanıt görüldüğünde bu tip ve
 * mapper'ı buna göre doğrulayın/düzeltin.
 */
export interface IncomingExternalSummary {
  ettn: string
  documentNumber: string
  /** Entegratörün verdiği fatura numarası — `belgeNumarasi`'ndan ayrı. */
  invoiceNumber: string
  sellerTaxOrIdentityNumber: string
  sellerName: string
  date: string
  documentType: DocumentTypeCode
  approvalStatus: ApprovalStatusValue
}

export interface CancelDraftOptions {
  /**
   * Taslağın aranacağı tarih. Varsayılan: bugün.
   *
   * Eski davranış aramayı her zaman bugüne sabitliyordu; dünkü (veya daha
   * eski) bir taslak bu API üzerinden asla silinemiyordu (bkz. I10).
   */
  date?: DateInput
}
