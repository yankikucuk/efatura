import { describe, expect, it } from 'vitest'

import { isValidTaxOrIdentityNumber } from './identity.js'

describe('isValidTaxOrIdentityNumber (documents katmanına taşındı)', () => {
  it('10 haneli VKN ve 11 haneli TCKN kabul eder', () => {
    expect(isValidTaxOrIdentityNumber('1234567890')).toBe(true)
    expect(isValidTaxOrIdentityNumber('11111111111')).toBe(true)
  })

  it('yanlış uzunluk ve rakam dışı karakter reddeder', () => {
    expect(isValidTaxOrIdentityNumber('123')).toBe(false)
    expect(isValidTaxOrIdentityNumber('123456789012')).toBe(false)
    expect(isValidTaxOrIdentityNumber('1234ABC890')).toBe(false)
    expect(isValidTaxOrIdentityNumber('')).toBe(false)
  })
})
