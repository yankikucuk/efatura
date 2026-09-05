import type { DocumentTypeCode } from '../../constants/index.js'

/**
 * Belge görüntüleme ve indirme seçenekleri — `getInvoiceHtml`,
 * `downloadPackage`, `getDownloadUrl`, `toPdf` ve makbuz karşılıkları
 * tarafından paylaşılır.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { DocumentOptions } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * // İmzalanmış (onaylanmış) sürümü iste.
 * const options: DocumentOptions = { signed: true }
 * const html = await client.getInvoiceHtml('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', options)
 * console.log(html.length)
 * ```
 */
export interface DocumentOptions {
  /**
   * Belgenin imzalı sürümü mü istendiği. Portal bunu `onayDurumu` alanında
   * Türkçe metin olarak bekliyor. Varsayılan `false` (Onaylanmadı).
   */
  signed?: boolean
}

/**
 * Belge İNDİRME seçenekleri — `downloadPackage` ve `getDownloadUrl`.
 *
 * `DocumentOptions`'ı `documentType` ile genişletir. Alan ayrı bir tipe
 * konuldu, `DocumentOptions`'a EKLENMEDİ: `getInvoiceHtml`/`toPdf` de
 * `DocumentOptions` alıyor ve portal gösterim komutunda belge türünü
 * DİKKATE ALMIYOR (ek `belgeTuru` alanı denendi, sonucu değiştirmedi —
 * canlı doğrulandı 2026-09-05). Ortak tipe eklenseydi, gösterim yollarında
 * sessizce yok sayılan bir seçenek oluşurdu; tip düzeyinde "burada anlamı
 * var, orada yok" demek bunu baştan engelliyor.
 *
 * @example Müstahsil makbuzunun ZIP paketini indirmek
 * ```ts
 * import { DocumentType, EArsivClient } from '@yankikucuk/efatura'
 * import type { DownloadOptions } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const options: DownloadOptions = { documentType: DocumentType.PRODUCER_RECEIPT }
 * const zip = await client.downloadPackage('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', options)
 * console.log(zip.byteLength)
 * ```
 */
export interface DownloadOptions extends DocumentOptions {
  /**
   * İndirilecek belgenin TÜRÜ; portala `belgeTip` alanında gider.
   * Varsayılan `DocumentType.INVOICE` (`FATURA`).
   *
   * DİKKAT: yanlış tür SESSİZCE boş yanıt üretir. Portal, makbuz ETTN'i +
   * `belgeTip=FATURA` çiftine `HTTP 200` ve **0 bayt** ile karşılık veriyor;
   * hata metni YOKTUR (canlı doğrulandı 2026-09-05). Bu durumda istemci
   * `EArsivNetworkError` fırlatır; arıza sessiz kalmaz ama hata bir TEŞHİS
   * koyamaz — yalnızca üç olasılığı (belge türü, ETTN, onay durumu) sayar.
   *
   * Dönen FORMAT da türe göre değişir: `FATURA` ve `MÜSTAHSİL MAKBUZU` ZIP,
   * `SERBEST MESLEK MAKBUZU` doğrudan PDF döndürür.
   */
  documentType?: DocumentTypeCode
}
