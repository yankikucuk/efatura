/**
 * Belge görüntüleme ve indirme seçenekleri — `getInvoiceHtml`,
 * `downloadPackage`, `getDownloadUrl`, `toPdf` ve makbuz karşılıkları
 * tarafından paylaşılır.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { DocumentOptions } from 'efatura'
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
