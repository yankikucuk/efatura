import type { DocumentOptions } from '../modules/document/index.js'
import type { PdfOptions } from '../pdf/index.js'

/** `toPdf` için belge ve PDF seçeneklerinin birleşimi. */
export type ToPdfOptions = DocumentOptions & PdfOptions
