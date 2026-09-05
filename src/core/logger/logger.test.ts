import { describe, expect, it, vi } from 'vitest'

import { type Logger, noopLogger } from './index.js'

describe('noopLogger', () => {
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
