import type { DocumentOptions } from '../modules/document/index.js'
import type { PdfOptions } from '../pdf/index.js'

/**
 * `toPdf` için belge ve PDF seçeneklerinin birleşimi.
 *
 * `DocumentOptions`'tan `signed`, `PdfOptions`'tan `format`,
 * `printBackground`, `margin` ve `moduleName` alanlarını taşır; hepsi
 * opsiyoneldir.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { ToPdfOptions } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const options: ToPdfOptions = {
 *   signed: true,
 *   format: 'A4',
 *   margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
 * }
 * const pdf = await client.toPdf('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', options)
 * console.log(pdf.byteLength > 0)
 * ```
 */
export type ToPdfOptions = DocumentOptions & PdfOptions
