/**
 * Opsiyonel PDF üretiminin sözleşmesi.
 *
 * `puppeteer` bilinçli olarak OPSİYONEL bir peer bağımlılıktır: PDF istemeyen
 * kullanıcı ~300 MB'lık bir tarayıcı indirmez. Bunun bedeli modülün ancak
 * çalışma zamanında bulunabilmesidir ve buradaki asıl risk hata mesajının
 * KALİTESİDİR — `Cannot find module 'puppeteer'` gören kullanıcı kendi
 * kurulumunda hata arar. Süit, hatanın (a) kütüphanenin kendi doğrulama hatası
 * tipinde olduğunu, (b) düzeltmenin tam komutunu (`npm i puppeteer`)
 * içerdiğini sabitler.
 *
 * `moduleName` seçeneği yalnızca bu yolu test edilebilir kılmak için vardır:
 * var olmayan bir modül adı verilerek "kurulu değil" dalı, puppeteer'ın KURULU
 * olduğu bir makinede de deterministik olarak zorlanabiliyor.
 */

import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../core/index.js'

import { renderHtmlToPdf } from './pdf.renderer.js'

describe('renderHtmlToPdf', () => {
  // Kapsam: puppeteer yokluğunda verilen hatanın tipi ve metni + boş HTML
  // girdisinin reddi.
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
