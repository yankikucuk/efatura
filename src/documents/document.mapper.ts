import {
  ApprovalStatus,
  type ApprovalStatusValue,
  DocumentType,
  type DocumentTypeCode,
} from '../constants/index.js'
import { formatPortalDate } from '../core/index.js'

import type { DocumentSummary } from './document.types.js'
import { str } from './portal-field.js'

/**
 * Bir tarih alanını normalize eder; ayrıştırılamazsa ham stringi geri verir.
 * `str()` yalnızca alan STRING DEĞİLSE varsayılana düşer — boş string ('')
 * geçerli bir string olduğu için varsayılanı tetiklemez ve doğrudan
 * `formatPortalDate('')`'a gider, ki bu fırlatır (bkz. I5). Tek bir bozuk
 * alanın çağıranı düşürmemesi için bu fırlatma burada yutulur.
 *
 * Hem `toDocumentSummary` (liste satırları) hem `InvoiceService.getInvoice`
 * (tekil detay — round 2 madde 3: aynı `str()` kör noktası okuma yolunda da
 * vardı, `input.date` boş geldiğinde `formatPortalDate(input.date)`
 * fırlatıyor ve çağıran `detail.raw`'a bile erişemiyordu) tarafından
 * paylaşılır.
 */
export function normalizeSummaryDate(raw: unknown): string {
  const rawDate = str(raw, formatPortalDate())
  try {
    return formatPortalDate(rawDate)
  } catch {
    return rawDate
  }
}

/**
 * Taslak listesi satırını normalize eder. Portal bu listede tarihi tire ile
 * döndürüyor (`03-09-2026`) ancak fatura yükünde eğik çizgi bekliyor.
 *
 * Tek bir satırın alanı bozuksa (ör. ayrıştırılamayan tarih) bu fonksiyon
 * FIRLATMAZ — bkz. `normalizeSummaryDate`. Aksi halde `listDrafts` gibi bir
 * toplu listeleme, paylaşılan test kullanıcı havuzundaki YABANCI tek bir
 * kayıt yüzünden tamamen başarısız olurdu (bkz. I5; `createDraft` içindeki
 * ikinci `listDrafts` çağrısı özellikle risklidir: ETTN çözümü bu listeye
 * bağlıdır).
 */
export function toDocumentSummary(raw: Record<string, unknown>): DocumentSummary {
  return {
    ettn: str(raw.ettn),
    documentNumber: str(raw.belgeNumarasi),
    buyerTaxOrIdentityNumber: str(raw.aliciVknTckn),
    buyerName: str(raw.aliciUnvanAdSoyad),
    date: normalizeSummaryDate(raw.belgeTarihi),
    documentType: str(raw.belgeTuru, DocumentType.INVOICE) as DocumentTypeCode,
    approvalStatus: str(raw.onayDurumu, ApprovalStatus.NOT_APPROVED) as ApprovalStatusValue,
  }
}

/**
 * Karışık bir taslak listesini tek bir belge türüne indirger.
 *
 * `EARSIV_PORTAL_TASLAKLARI_GETIR`'in `hangiTip: 'Buyuk'` listesi bir belge
 * türü FİLTRESİ DEĞİL, bir ÜST KÜMEDİR: fatura, müstahsil makbuzu ve serbest
 * meslek makbuzu aynı satır biçiminde birlikte döner (canlı doğrulandı
 * 2026-09-05 — tek oturumda üç belge oluşturuldu; `5000/30000` bir satır,
 * `Buyuk` üç satır döndürdü). Bu yüzden makbuz listeleyen her servis sonucu
 * `belgeTuru` ile süzmek ZORUNDADIR; süzmemek "makbuzlarınız" diye
 * faturalarınızı da göstermek olurdu.
 */
export function filterByDocumentType(
  rows: readonly DocumentSummary[],
  documentType: DocumentTypeCode,
): DocumentSummary[] {
  return rows.filter((row) => row.documentType === documentType)
}
