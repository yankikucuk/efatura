import type { ApprovalStatusValue, DocumentTypeCode } from '../constants/index.js'

/**
 * Taslak listesinin bir satırı.
 *
 * `invoice` modülünden buraya taşındı (`InvoiceSummary` olarak): herhangi bir
 * portal belge tipini (fatura, müstahsil makbuzu, serbest meslek makbuzu)
 * tanımlar, yalnızca faturaya özgü değildir — `EARSIV_PORTAL_TASLAKLARI_GETIR`
 * hepsini aynı satır biçiminde döndürür, tipi `documentType` ayırt eder.
 */
export interface DocumentSummary {
  ettn: string
  documentNumber: string
  buyerTaxOrIdentityNumber: string
  buyerName: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi. */
  date: string
  documentType: DocumentTypeCode
  approvalStatus: ApprovalStatusValue
}
