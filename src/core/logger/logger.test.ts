/**
 * Günlükleme sözleşmesi.
 *
 * Kütüphane kendiliğinden hiçbir şey yazdırmaz: varsayılan `noopLogger`'dır ve
 * çağıran kendi `Logger`'ını enjekte edene kadar tek satır çıktı üretilmez.
 * Bir kütüphanenin sahibinin konsoluna izinsiz yazması kabul edilemez; bu süit
 * (a) noop'un her seviyeyi sessizce yuttuğunu, (b) arayüzün dışarıdan
 * uygulanabilir olduğunu güvence altına alır.
 *
 * Hassas veri kuralı (token/şifre günlüğe düşmez) burada değil,
 * `transport/http-client.test.ts`'teki I1 testinde sabitlenir.
 */

import { describe, expect, it, vi } from 'vitest'

import { type Logger, noopLogger } from './index.js'

describe('noopLogger', () => {
  // Kapsam: varsayılan sessizlik ve `Logger` arayüzünün dışarıdan
  // uygulanabilirliği.
  it('tüm seviyeleri sessizce yutar', () => {
    expect(() => {
      noopLogger.debug('m', { a: 1 })
      noopLogger.info('m')
      noopLogger.warn('m')
      noopLogger.error('m')
    }).not.toThrow()
  })

  it('özel bir Logger uygulaması arayüze uyar', () => {
    const debug = vi.fn()
    const custom: Logger = { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    custom.debug('istek gönderildi', { command: 'X' })
    expect(debug).toHaveBeenCalledWith('istek gönderildi', { command: 'X' })
  })
})
