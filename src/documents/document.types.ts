import type { ApprovalStatusValue, CountryName, DocumentTypeCode } from '../constants/index.js'

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

/**
 * Bir belge oluşturma işleminin sonucu.
 *
 * Fatura ve her iki makbuz türü de AYNI şekli döndürüyor: portal oluşturma
 * yanıtında yalnızca bir durum cümlesi veriyor, kimlik bilgisi anlık
 * görüntü farkıyla listeden çözülüyor (bkz. `resolveCreatedEttn`). Kardeş
 * modüller birbirini import edemediği için tip burada, yaprak katmanda
 * duruyor; `CreatedInvoice` bunun takma adıdır.
 */
export interface CreatedDocument {
  ettn: string
  documentNumber: string
  date: string
  approvalStatus: ApprovalStatusValue
}

/**
 * Portal belgelerinde ortak adres girdisi.
 *
 * `invoice.types.ts`'ten buraya taşındı: serbest meslek makbuzu da aynı
 * alanları (farklı Türkçe anahtar yazımlarıyla) taşıyor ve kardeş modülden
 * import edemiyor. `invoice` bu adı geriye dönük uyumluluk için kendi
 * yüzeyinden yeniden dışa açar.
 */
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
