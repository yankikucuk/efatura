/**
 * İstemci seçeneklerinin çözümlenmesi — kütüphanenin TEK yapılandırma kapısı.
 *
 * Birinci güvence: yanlış yapılandırma AĞA ÇIKMADAN reddedilir. `timeoutMs: 0`
 * veya `attempts: 0` sessizce kabul edilseydi semptom aylar sonra "istek hiç
 * dönmüyor" ya da "hiç yeniden denenmiyor" olarak ortaya çıkardı ve sebebi
 * yapılandırmada aranmazdı.
 *
 * İkinci güvence ortam seçimidir: canlı ve test portalları AYRI ana adlardır.
 * Varsayılanın yanlışlıkla `test` olması, gerçek fatura kesmek isteyen
 * kullanıcının belgelerini hukuken hiçbir hükmü olmayan bir ortamda
 * oluşturmasına yol açardı — bu yüzden varsayılan `production` olarak
 * sabitlenmiştir.
 */

import { describe, expect, it } from 'vitest'

import { EArsivValidationError, noopLogger } from '../core/index.js'

import { BASE_URLS, resolveClientOptions } from './index.js'

describe('resolveClientOptions', () => {
  // Kapsam: varsayılanlar, ortam seçimi, kısmi `retry` birleştirmesi ve
  // geçersiz değerlerin yerelde reddedilmesi.
  it('varsayılan olarak production ortamını seçer', () => {
    const resolved = resolveClientOptions()
    expect(resolved.environment).toBe('production')
    expect(resolved.baseUrl).toBe('https://earsivportal.efatura.gov.tr')
    expect(resolved.timeoutMs).toBe(30_000)
    expect(resolved.retry).toEqual({ attempts: 3, backoffMs: 500 })
    expect(resolved.logger).toBe(noopLogger)
    expect(resolved.userAgent).toContain('Mozilla/5.0')
  })

  it('test ortamının taban adresini verir', () => {
    expect(resolveClientOptions({ environment: 'test' }).baseUrl).toBe(
      'https://earsivportaltest.efatura.gov.tr',
    )
  })

  it('taban adresleri iki ortamı kapsar', () => {
    expect(Object.keys(BASE_URLS).sort()).toEqual(['production', 'test'])
  })

  it('kısmi retry ayarını varsayılanlarla birleştirir', () => {
    expect(resolveClientOptions({ retry: { attempts: 5 } }).retry).toEqual({
      attempts: 5,
      backoffMs: 500,
    })
  })

  it('bilinmeyen ortamda hata fırlatır', () => {
    expect(() => resolveClientOptions({ environment: 'staging' as 'test' })).toThrow(
      EArsivValidationError,
    )
  })

  it('geçersiz timeout değerinde hata fırlatır', () => {
    expect(() => resolveClientOptions({ timeoutMs: 0 })).toThrow(EArsivValidationError)
    expect(() => resolveClientOptions({ timeoutMs: -1 })).toThrow(EArsivValidationError)
  })

  it('deneme sayısı en az 1 olmalıdır', () => {
    expect(() => resolveClientOptions({ retry: { attempts: 0 } })).toThrow(EArsivValidationError)
  })
})
