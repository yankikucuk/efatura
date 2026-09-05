import type {
  ApprovalStatusValue,
  CountryName,
  CurrencyCode,
  DocumentTypeCode,
  InvoiceListKindValue,
  InvoiceTypeCode,
  UnitCode,
} from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'

export interface AddressInput {
  country?: CountryName
  city?: string
  district?: string
  street?: string
  buildingName?: string
  buildingNumber?: string
  doorNumber?: string
  town?: string
  postalCode?: string
}

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

/** Taslak listesinin bir satırı. */
export interface InvoiceSummary {
  ettn: string
  documentNumber: string
  buyerTaxOrIdentityNumber: string
  buyerName: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi. */
  date: string
  documentType: DocumentTypeCode
  approvalStatus: ApprovalStatusValue
}

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

/** `createDraft` sonucu. */
export interface CreatedInvoice {
  ettn: string
  documentNumber: string
  date: string
  approvalStatus: ApprovalStatusValue
}

export interface ListOptions {
  /** Varsayılan `InvoiceListKind.INTERACTIVE`. */
  kind?: InvoiceListKindValue
}
