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
 *
 * `puppeteer` İSTEĞE BAĞLI bir eş bağımlılıktır ve DİNAMİK olarak yüklenir:
 * kurulu değilse çekirdek kütüphane etkilenmez, yalnızca bu çağrı hata verir.
 * Tarayıcı her çağrıda başlatılıp `finally` içinde kapatılır.
 *
 * @param html Dönüştürülecek HTML. Boş ya da yalnızca boşluk olamaz. Sayfa
 *   `networkidle0` beklenerek yüklenir — dış kaynaklara giden istekler
 *   tamamlanana kadar beklenir.
 * @param options Sayfa boyutu, arka plan, kenar boşlukları ve yüklenecek
 *   modül adı. Verilmezse `A4`, arka plan AÇIK ve dört yönde `10mm` kenar
 *   boşluğu kullanılır.
 * @returns PDF dosyasının ham baytları.
 * @throws {EArsivValidationError} `html` boşsa ya da `puppeteer` (veya
 *   `options.moduleName` ile verilen modül) yüklenemezse. Hatanın `issues`
 *   dizisi yükleme hatasının kök nedenini taşır.
 *
 * @example
 * ```ts
 * import { writeFile } from 'node:fs/promises'
 *
 * import { EArsivClient, renderHtmlToPdf } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const html = await client.getInvoiceHtml('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * const pdf = await renderHtmlToPdf(html, { format: 'A4', printBackground: true })
 * await writeFile('fatura.pdf', pdf)
 * ```
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
