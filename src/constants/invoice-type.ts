/** Portal `faturaTipi` alanı. */
export const InvoiceType = {
  SALE: 'SATIS',
  REFUND: 'IADE',
  WITHHOLDING: 'TEVKIFAT',
  EXEMPTION: 'ISTISNA',
  SPECIAL_BASE: 'OZELMATRAH',
  EXPORT_REGISTERED: 'IHRACKAYITLI',
  MARKETPLACE_SALE: 'HKSSATIS',
  MARKETPLACE_COMMISSION: 'HKSKOMISYONCU',
} as const

export type InvoiceTypeCode = (typeof InvoiceType)[keyof typeof InvoiceType]
