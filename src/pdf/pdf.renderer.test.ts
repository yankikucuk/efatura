import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../core/index.js'

import { renderHtmlToPdf } from './pdf.renderer.js'

describe('renderHtmlToPdf', () => {
  it('puppeteer kurulu değilse kurulum talimatı veren hata fırlatır', async () => {
    await expect(
      renderHtmlToPdf('<html><body>fatura</body></html>', {
        // Var olmayan bir modül adı vererek "kurulu değil" yolunu zorluyoruz.
        moduleName: 'puppeteer-kurulu-degil-test',
      }),
    ).rejects.toThrow(EArsivValidationError)

    await expect(
      renderHtmlToPdf('<html/>', { moduleName: 'puppeteer-kurulu-degil-test' }),
    ).rejects.toThrow(/npm i puppeteer/)
  })

  it('boş HTML reddedilir', async () => {
    await expect(renderHtmlToPdf('   ')).rejects.toThrow(/HTML/)
  })
})
