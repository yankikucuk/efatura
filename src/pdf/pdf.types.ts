export interface PdfOptions {
  /** Sayfa boyutu; puppeteer `format` değeri. Varsayılan `A4`. */
  format?: 'A4' | 'A5' | 'Letter'
  /** Arka plan renklerini ve görselleri bas. Varsayılan `true`. */
  printBackground?: boolean
  /** Kenar boşlukları, CSS birimiyle. */
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  /**
   * Yüklenecek modül adı. Yalnızca test ve özel dağıtımlar için;
   * varsayılan `puppeteer`.
   */
  moduleName?: string
}

/** Kullandığımız puppeteer yüzeyinin en dar tanımı. */
export interface PuppeteerLike {
  launch(options?: { headless?: boolean | 'shell' }): Promise<{
    newPage(): Promise<{
      setContent(html: string, options?: { waitUntil?: string }): Promise<void>
      pdf(options?: Record<string, unknown>): Promise<Uint8Array>
    }>
    close(): Promise<void>
  }>
}
