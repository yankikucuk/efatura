import {
  ApprovalStatus,
  type ApprovalStatusValue,
  DocumentType,
  type DocumentTypeCode,
} from '../constants/index.js'
import { formatPortalDate } from '../core/index.js'

import type { DocumentSummary } from './document.types.js'

/**
 * `invoice.mapper.ts`'teki `str()` ile AYNI, ancak KASITLI olarak ayrı bir
 * kopyadır — taşınmadı. `invoice.mapper.ts` bu yardımcıyı özet dışı birçok
 * alan için de kullanıyor (adres, iletişim, tutarlar); onu buraya taşımak
 * ya orayı kırardı ya da tek bir dahili string-normalize yardımcısını genel
 * public API yüzeyine çıkarırdı. İki satırlık saf bir fonksiyon için bu
 * bedel gereksiz; bkz. rapor "pure move" notu.
 */
const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

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
