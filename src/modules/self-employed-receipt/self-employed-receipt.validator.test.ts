import { describe, expect, it } from 'vitest'

import { Currency } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import type { SelfEmployedReceiptInput } from './self-employed-receipt.types.js'
import { validateSelfEmployedReceiptInput } from './self-employed-receipt.validator.js'

const base = (overrides: Partial<SelfEmployedReceiptInput> = {}): SelfEmployedReceiptInput => ({
  payer: { taxOrIdentityNumber: '11111111111', firstName: 'Ali', lastName: 'Yılmaz' },
  lineItems: [{ description: 'Danışmanlık', grossFee: 1000, vatRate: 20, withholdingRate: 20 }],
  ...overrides,
})

describe('validateSelfEmployedReceiptInput', () => {
  it('geçerli makbuzu kabul eder', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(base())
    }).not.toThrow()
  })

  it('geçersiz VKN/TCKN reddeder', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(base({ payer: { taxOrIdentityNumber: '123' } }))
    }).toThrow(EArsivValidationError)
  })

  it('ünvan da ad/soyad da yoksa reddeder', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(base({ payer: { taxOrIdentityNumber: '11111111111' } }))
    }).toThrow(/ünvan|ad/i)
  })

  it('ünvan verilmişse ad soyad gerekmez', () => {
    // Serbest meslek makbuzu — faturadan farklı olarak — tüzel kişiye de
    // kesilebilir; portal yükünde `unvan` alanı vardır.
    expect(() => {
      validateSelfEmployedReceiptInput(
        base({ payer: { taxOrIdentityNumber: '1234567890', title: 'ACME A.Ş.' } }),
      )
    }).not.toThrow()
  })

  it('boş kalem listesini reddeder', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(base({ lineItems: [] }))
    }).toThrow(EArsivValidationError)
  })

  it('aralık dışı oranları alan yollarıyla reddeder', () => {
    const invalid = base({
      lineItems: [
        {
          description: 'Danışmanlık',
          grossFee: 100,
          vatRate: 150,
          withholdingRate: -1,
          vatWithholdingRate: 101,
        },
      ],
    })
    try {
      validateSelfEmployedReceiptInput(invalid)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      const paths = (error as EArsivValidationError).issues.map((issue) => issue.path)
      expect(paths).toContain('lineItems.0.vatRate')
      expect(paths).toContain('lineItems.0.withholdingRate')
      expect(paths).toContain('lineItems.0.vatWithholdingRate')
    }
  })

  it('negatif brüt ücreti reddeder', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(
        base({ lineItems: [{ description: 'X', grossFee: -1, vatRate: 20 }] }),
      )
    }).toThrow(/brüt/i)
  })

  it('TRY dışı para biriminde kur zorunludur', () => {
    expect(() => {
      validateSelfEmployedReceiptInput(base({ currency: Currency.EURO }))
    }).toThrow(/kur/i)
    expect(() => {
      validateSelfEmployedReceiptInput(base({ currency: Currency.EURO, currencyRate: 38.2 }))
    }).not.toThrow()
  })
})
