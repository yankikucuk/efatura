/** Portal `belgeTuru` alanı. v1 yalnızca faturayı kapsar. */
export const DocumentType = { INVOICE: 'FATURA' } as const
export type DocumentTypeCode = (typeof DocumentType)[keyof typeof DocumentType]

/** Portal `onayDurumu` alanı — Türkçe metin, kod değil. */
export const ApprovalStatus = { APPROVED: 'Onaylandı', NOT_APPROVED: 'Onaylanmadı' } as const
export type ApprovalStatusValue = (typeof ApprovalStatus)[keyof typeof ApprovalStatus]

/**
 * `EARSIV_PORTAL_TASLAKLARI_GETIR` iki farklı listeyi `hangiTip` ile ayırır.
 * INTERACTIVE: e-Arşiv Fatura (İnteraktif), pageName RG_BASITTASLAKLAR.
 * STANDARD: e-Arşiv Fatura, pageName RG_TASLAKLAR.
 */
export const InvoiceListKind = { INTERACTIVE: '5000/30000', STANDARD: 'Buyuk' } as const
export type InvoiceListKindValue = (typeof InvoiceListKind)[keyof typeof InvoiceListKind]
