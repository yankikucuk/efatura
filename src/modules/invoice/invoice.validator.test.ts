import { describe, expect, it } from 'vitest'

import { Currency, Unit } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import type { InvoiceInput } from './invoice.types.js'
import { isValidTaxOrIdentityNumber, validateInvoiceInput } from './invoice.validator.js'

const base = (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  buyer: { taxOrIdentityNumber: '11111111111', firstName: 'Ali', lastName: 'Yılmaz' },
  lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
  ...overrides,
})

describe('isValidTaxOrIdentityNumber', () => {
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

describe('validateInvoiceInput', () => {
  it('geçerli faturayı kabul eder', () => {
    expect(() => {
      validateInvoiceInput(base())
    }).not.toThrow()
  })

  it('geçersiz VKN/TCKN reddeder', () => {
    expect(() => {
      validateInvoiceInput(base({ buyer: { taxOrIdentityNumber: '123' } }))
    }).toThrow(EArsivValidationError)
  })

  it('alıcı kimliği olmadan reddeder', () => {
    const input = base()
    input.buyer = { taxOrIdentityNumber: '11111111111' }
    expect(() => {
      validateInvoiceInput(input)
    }).toThrow(/ünvan|ad/i)
  })

  it('ünvan verilmişse ad soyad gerekmez', () => {
    expect(() => {
      validateInvoiceInput(
        base({ buyer: { taxOrIdentityNumber: '1234567890', title: 'ACME A.Ş.' } }),
      )
    }).not.toThrow()
  })

  it('boş kalem listesini reddeder', () => {
    expect(() => {
      validateInvoiceInput(base({ lineItems: [] }))
    }).toThrow(EArsivValidationError)
  })

  it('TRY dışı para biriminde kur zorunludur', () => {
    expect(() => {
      validateInvoiceInput(base({ currency: Currency.US_DOLLAR }))
    }).toThrow(/kur/i)
    expect(() => {
      validateInvoiceInput(base({ currency: Currency.US_DOLLAR, currencyRate: 34.5 }))
    }).not.toThrow()
  })

  it('TRY için kur gerekmez', () => {
    expect(() => {
      validateInvoiceInput(base({ currency: Currency.TURKISH_LIRA }))
    }).not.toThrow()
  })

  it('aralık dışı KDV oranını reddeder', () => {
    const input = base()
    input.lineItems[0]!.vatRate = 150
    expect(() => {
      validateInvoiceInput(input)
    }).toThrow(EArsivValidationError)
  })

  it('aralık dışı ek vergi oranını reddeder', () => {
    const input = base()
    input.lineItems[0]!.additionalTaxRate = 150
    expect(() => {
      validateInvoiceInput(input)
    }).toThrow(EArsivValidationError)
    try {
      validateInvoiceInput(input)
    } catch (error) {
      // Hata yolu alanı işaret etmeli; aşağı akıştaki applyPercent yalnızca
      // "oran" diyebiliyordu.
      expect((error as EArsivValidationError).issues[0]?.path).toBe('lineItems.0.additionalTaxRate')
    }
  })

  it('özel matrah alanlarını doğrular', () => {
    expect(() => {
      validateInvoiceInput(base({ specialBase: { rate: 150 } }))
    }).toThrow(/Özel matrah oranı/)
    expect(() => {
      validateInvoiceInput(base({ specialBase: { amount: -1 } }))
    }).toThrow(/Özel matrah tutarı/)
    expect(() => {
      validateInvoiceInput(base({ specialBase: { rate: 8, amount: 100 } }))
    }).not.toThrow()
  })

  it('tüm sorunları tek seferde toplar', () => {
    const input = base({
      buyer: { taxOrIdentityNumber: 'abc' },
      lineItems: [],
      currency: Currency.EURO,
    })
    try {
      validateInvoiceInput(input)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('hata alan yolları nokta gösterimindedir', () => {
    try {
      validateInvoiceInput(base({ buyer: { taxOrIdentityNumber: 'abc', title: 'X' } }))
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues[0]?.path).toBe('buyer.taxOrIdentityNumber')
    }
  })
})
