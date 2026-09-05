/**
 * Portal `belgeTuru` alanı.
 *
 * Metinler portalın kendi Türkçe diakritikli yazımıdır ve liste satırlarını
 * süzmek için BİREBİR eşleşmek zorundadır (canlı doğrulandı 2026-09-05).
 * Kendi elinizle `'MUSTAHSIL MAKBUZU'` gibi diakritiksiz bir metin yazmak
 * sessizce hiçbir satırla eşleşmez.
 *
 * @example Karışık listeyi türe göre ayırmak
 * ```ts
 * import { DocumentType, EArsivClient, InvoiceListKind } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const all = await client.listDrafts(new Date(), new Date(), {
 *   kind: InvoiceListKind.STANDARD,
 * })
 * const makbuzlar = all.filter((row) => row.documentType !== DocumentType.INVOICE)
 * console.log(makbuzlar.length)
 * ```
 */
export const DocumentType = {
  /** `FATURA` — e-Arşiv faturası. Eşlemede yedek (varsayılan) değerdir. */
  INVOICE: 'FATURA',
  /** `MÜSTAHSİL MAKBUZU` — portalın kendi diakritikli yazımı. */
  PRODUCER_RECEIPT: 'MÜSTAHSİL MAKBUZU',
  /** `SERBEST MESLEK MAKBUZU` */
  SELF_EMPLOYED_RECEIPT: 'SERBEST MESLEK MAKBUZU',
} as const
/**
 * {@link DocumentType} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { DocumentType } from 'efatura'
 * import type { DocumentTypeCode } from 'efatura'
 *
 * const type: DocumentTypeCode = DocumentType.PRODUCER_RECEIPT
 * console.log(type)
 * ```
 */
export type DocumentTypeCode = (typeof DocumentType)[keyof typeof DocumentType]

/**
 * Portal `onayDurumu` alanı — Türkçe metin, kod değil.
 *
 * Liste satırlarının `approvalStatus` alanında döner; belge indirme ve
 * gösterme çağrılarında `DocumentOptions.signed` bu değerlere çevrilir
 * (`true` → `'Onaylandı'`, `false` → `'Onaylanmadı'`).
 *
 * @example
 * ```ts
 * import { ApprovalStatus, EArsivClient } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows = await client.listDrafts(new Date(), new Date())
 * const imzalananlar = rows.filter((row) => row.approvalStatus === ApprovalStatus.APPROVED)
 * console.log(imzalananlar.length)
 * ```
 */
export const ApprovalStatus = {
  /** `Onaylandı` — belge imzalanmış. */
  APPROVED: 'Onaylandı',
  /** `Onaylanmadı` — taslak. Eşlemede yedek (varsayılan) değerdir. */
  NOT_APPROVED: 'Onaylanmadı',
} as const
/**
 * {@link ApprovalStatus} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { ApprovalStatus } from 'efatura'
 * import type { ApprovalStatusValue } from 'efatura'
 *
 * const status: ApprovalStatusValue = ApprovalStatus.APPROVED
 * console.log(status)
 * ```
 */
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
 *
 * @example İki listenin farkını görmek
 * ```ts
 * import { EArsivClient, InvoiceListKind } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const today = new Date()
 * const yalnizcaFatura = await client.listDrafts(today, today, {
 *   kind: InvoiceListKind.INTERACTIVE,
 * })
 * const hepsi = await client.listDrafts(today, today, { kind: InvoiceListKind.STANDARD })
 * console.log(yalnizcaFatura.length, hepsi.length)
 * ```
 */
export const InvoiceListKind = {
  /** `'5000/30000'` — YALNIZCA faturalar; kütüphanenin varsayılanı. */
  INTERACTIVE: '5000/30000',
  /** `'Buyuk'` — fatura + her iki makbuz türü. Filtre değil, ÜST KÜME. */
  STANDARD: 'Buyuk',
} as const
/**
 * {@link InvoiceListKind} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { InvoiceListKind } from 'efatura'
 * import type { InvoiceListKindValue } from 'efatura'
 *
 * const kind: InvoiceListKindValue = InvoiceListKind.STANDARD
 * console.log(kind)
 * ```
 */
export type InvoiceListKindValue = (typeof InvoiceListKind)[keyof typeof InvoiceListKind]
