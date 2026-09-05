import { EArsivValidationError } from '../core/index.js'

import type { PdfOptions, PuppeteerLike } from './pdf.types.js'

const INSTALL_HINT =
  'PDF üretimi için puppeteer gerekli ancak kurulu değil. Kurmak için: npm i puppeteer'

async function loadPuppeteer(moduleName: string): Promise<PuppeteerLike> {
  try {
    // Dinamik import: paket kurulu değilse çekirdek kütüphane etkilenmez.
    const loaded = (await import(/* @vite-ignore */ moduleName)) as {
      default?: PuppeteerLike
    } & PuppeteerLike
    return loaded.default ?? loaded
  } catch (cause) {
    throw new EArsivValidationError(INSTALL_HINT, [
      { path: 'puppeteer', message: `Modül yüklenemedi: ${String(cause)}` },
    ])
  }
}

/**
 * Portalın ürettiği fatura HTML'ini PDF'e dönüştürür.
 *
 * Resmi belge paketi PDF içermediği için (spec §2.4) PDF burada HTML'den
 * üretilir. Çıktı resmi imzalı belge değildir; imzalı sürüm ZIP içindeki
 * UBL-TR XML dosyasıdır.
 */
export async function renderHtmlToPdf(html: string, options: PdfOptions = {}): Promise<Uint8Array> {
  if (html.trim().length === 0) {
    throw new EArsivValidationError('PDF üretmek için boş olmayan bir HTML gerekli.', [
      { path: 'html', message: 'HTML boş.' },
    ])
  }

  const puppeteer = await loadPuppeteer(options.moduleName ?? 'puppeteer')
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    return await page.pdf({
      format: options.format ?? 'A4',
      printBackground: options.printBackground ?? true,
      margin: options.margin ?? { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    })
  } finally {
    await browser.close()
  }
}
