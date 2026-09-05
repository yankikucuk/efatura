/**
 * Portal `belgeTuru` alanı.
 *
 * Metinler portalın kendi Türkçe diakritikli yazımıdır ve liste satırlarını
 * süzmek için BİREBİR eşleşmek zorundadır (canlı doğrulandı 2026-09-05).
 */
export const DocumentType = {
  INVOICE: 'FATURA',
  PRODUCER_RECEIPT: 'MÜSTAHSİL MAKBUZU',
  SELF_EMPLOYED_RECEIPT: 'SERBEST MESLEK MAKBUZU',
} as const
export type DocumentTypeCode = (typeof DocumentType)[keyof typeof DocumentType]

/** Portal `onayDurumu` alanı — Türkçe metin, kod değil. */
export const ApprovalStatus = { APPROVED: 'Onaylandı', NOT_APPROVED: 'Onaylanmadı' } as const
export type ApprovalStatusValue = (typeof ApprovalStatus)[keyof typeof ApprovalStatus]

/**
 * `EARSIV_PORTAL_TASLAKLARI_GETIR` iki farklı listeyi `hangiTip` ile ayırır.
 * INTERACTIVE: e-Arşiv Fatura (İnteraktif), pageName RG_BASITTASLAKLAR.
 * STANDARD: e-Arşiv Fatura, pageName RG_TASLAKLAR.
 *
 * DİKKAT: `STANDARD` bir belge türü FİLTRESİ DEĞİL, bir ÜST KÜMEDİR —
 * fatura ve her iki makbuz türü aynı listede döner (canlı doğrulandı
 * 2026-09-05: `5000/30000` yalnızca FATURA, `Buyuk` üçünü birden). Makbuz
 * listelemek için sonuç ayrıca `belgeTuru` ile süzülmelidir; bkz.
 * `filterByDocumentType`.
 */
export const InvoiceListKind = { INTERACTIVE: '5000/30000', STANDARD: 'Buyuk' } as const
export type InvoiceListKindValue = (typeof InvoiceListKind)[keyof typeof InvoiceListKind]
