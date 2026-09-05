/**
 * `renderHtmlToPdf` ve istemcinin PDF yöntemlerinin seçenekleri. Tümü
 * opsiyoneldir ve doğrudan puppeteer'a aktarılır.
 *
 * @example
 * ```ts
 * import { renderHtmlToPdf } from 'efatura'
 * import type { PdfOptions } from 'efatura'
 *
 * const options: PdfOptions = { format: 'A5', printBackground: false }
 * const pdf = await renderHtmlToPdf('<h1>Fatura</h1>', options)
 * console.log(pdf.byteLength > 0)
 * ```
 */
export interface PdfOptions {
  /** Sayfa boyutu; puppeteer `format` değeri. Varsayılan `A4`. */
  format?: 'A4' | 'A5' | 'Letter'
  /** Arka plan renklerini ve görselleri bas. Varsayılan `true`. */
  printBackground?: boolean
  /**
   * Kenar boşlukları, CSS birimiyle (ör. `'10mm'`, `'0.5in'`). Verilmezse
   * dört yönde de `10mm` kullanılır. Nesne verilirse EKSİK alanlar puppeteer
   * varsayılanına düşer, bu varsayılana değil.
   */
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  /**
   * Yüklenecek modül adı. Yalnızca test ve özel dağıtımlar için;
   * varsayılan `puppeteer`.
   */
  moduleName?: string
}

/**
 * Kullandığımız puppeteer yüzeyinin en dar tanımı.
 *
 * `puppeteer` isteğe bağlı bir eş bağımlılık (peer dependency) olduğu için
 * kütüphane onun tiplerine derleme zamanında bağımlı OLAMAZ; bu arayüz
 * yalnızca gerçekten çağrılan üç metodu tanımlar. Kendi tarayıcı
 * uygulamanızı `PdfOptions.moduleName` ile takarken bu şekle uymanız
 * yeterlidir.
 *
 * @example Sahte bir uygulama (testlerde kullanılır)
 * ```ts
 * import type { PuppeteerLike } from 'efatura'
 *
 * const fake: PuppeteerLike = {
 *   launch: async () => ({
 *     newPage: async () => ({
 *       setContent: async () => undefined,
 *       pdf: async () => new Uint8Array([1, 2, 3]),
 *     }),
 *     close: async () => undefined,
 *   }),
 * }
 * console.log(typeof fake.launch)
 * ```
 */
export interface PuppeteerLike {
  launch(options?: { headless?: boolean | 'shell' }): Promise<{
    newPage(): Promise<{
      setContent(html: string, options?: { waitUntil?: string }): Promise<void>
      pdf(options?: Record<string, unknown>): Promise<Uint8Array>
    }>
    close(): Promise<void>
  }>
}
