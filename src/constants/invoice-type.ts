/**
 * Portal `faturaTipi` alanı.
 *
 * Varsayılan `SALE`'dir; `createDraft` girdisinde `invoiceType` verilmezse bu
 * kullanılır. Türlerin bir kısmı ek alan gerektirir — ör. `SPECIAL_BASE`
 * (özel matrah) faturalarında `specialBase` alanları doldurulmalıdır.
 *
 * @example
 * ```ts
 * import { InvoiceType, Unit } from '@yankikucuk/efatura'
 * import type { InvoiceInput } from '@yankikucuk/efatura'
 *
 * const iade: InvoiceInput = {
 *   invoiceType: InvoiceType.REFUND,
 *   buyer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'İade', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 * }
 * console.log(iade.invoiceType)
 * ```
 */
export const InvoiceType = {
  /** `SATIS` — normal satış faturası. Varsayılan. */
  SALE: 'SATIS',
  /** `IADE` — iade faturası. */
  REFUND: 'IADE',
  /** `TEVKIFAT` — KDV tevkifatlı fatura. */
  WITHHOLDING: 'TEVKIFAT',
  /** `ISTISNA` — KDV'den istisna fatura. */
  EXEMPTION: 'ISTISNA',
  /** `OZELMATRAH` — özel matrah; `specialBase` alanlarıyla birlikte kullanılır. */
  SPECIAL_BASE: 'OZELMATRAH',
  /** `IHRACKAYITLI` — ihraç kayıtlı satış. */
  EXPORT_REGISTERED: 'IHRACKAYITLI',
  /** `HKSSATIS` — hal kayıt sistemi satışı. */
  MARKETPLACE_SALE: 'HKSSATIS',
  /** `HKSKOMISYONCU` — hal kayıt sistemi komisyoncu faturası. */
  MARKETPLACE_COMMISSION: 'HKSKOMISYONCU',
} as const

/**
 * {@link InvoiceType} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { InvoiceType } from '@yankikucuk/efatura'
 * import type { InvoiceTypeCode } from '@yankikucuk/efatura'
 *
 * const type: InvoiceTypeCode = InvoiceType.EXEMPTION
 * console.log(type)
 * ```
 */
export type InvoiceTypeCode = (typeof InvoiceType)[keyof typeof InvoiceType]
