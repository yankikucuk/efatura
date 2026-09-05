import { describe, expect, it } from 'vitest'

import { Unit } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import type { ProducerReceiptInput } from './producer-receipt.types.js'
import { validateProducerReceiptInput } from './producer-receipt.validator.js'

const base = (overrides: Partial<ProducerReceiptInput> = {}): ProducerReceiptInput => ({
  producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ali', lastName: 'Yılmaz' },
  lineItems: [{ name: 'Ceviz', quantity: 10, unit: Unit.KILOGRAM, unitPrice: 100 }],
  ...overrides,
})

describe('validateProducerReceiptInput', () => {
  it('geçerli makbuzu kabul eder', () => {
    expect(() => {
      validateProducerReceiptInput(base())
    }).not.toThrow()
  })

  it('geçersiz VKN/TCKN reddeder', () => {
    expect(() => {
      validateProducerReceiptInput(base({ producer: { taxOrIdentityNumber: '123' } }))
    }).toThrow(/VKN|TCKN/i)
  })

  it('adı ve soyadı olmayan müstahsili reddeder', () => {
    // Müstahsil makbuzunda `unvan` alanı HİÇ YOKTUR — tüzel kişiye
    // kesilemez. Portal boş ad kabul ediyor (canlı doğrulandı) ama adsız bir
    // makbuz hukuken geçersizdir; bu yüzden portaldan DAHA KATIYIZ.
    expect(() => {
      validateProducerReceiptInput(base({ producer: { taxOrIdentityNumber: '11111111111' } }))
    }).toThrow(/ad/i)
  })

  it('yalnızca soyadı verilmesi yeterlidir', () => {
    expect(() => {
      validateProducerReceiptInput(
        base({ producer: { taxOrIdentityNumber: '11111111111', lastName: 'Yılmaz' } }),
      )
    }).not.toThrow()
  })

  it('boş kalem listesini reddeder', () => {
    expect(() => {
      validateProducerReceiptInput(base({ lineItems: [] }))
    }).toThrow(EArsivValidationError)
  })

  it('aralık dışı kesinti oranını alan yoluyla birlikte reddeder', () => {
    try {
      validateProducerReceiptInput(
        base({
          lineItems: [
            {
              name: 'Ceviz',
              quantity: 1,
              unit: Unit.KILOGRAM,
              unitPrice: 10,
              taxRates: { pastureFund: 150 },
            },
          ],
        }),
      )
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      // Yol alanı olmasaydı aşağı akıştaki applyPercent yalnızca "oran"
      // diyebilirdi ve çağıran hangi kesintinin bozuk olduğunu bilemezdi.
      expect((error as EArsivValidationError).issues[0]?.path).toBe(
        'lineItems.0.taxRates.pastureFund',
      )
    }
  })

  it('tüm sorunları tek seferde toplar', () => {
    try {
      validateProducerReceiptInput(
        base({ producer: { taxOrIdentityNumber: 'abc' }, lineItems: [] }),
      )
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues.length).toBeGreaterThanOrEqual(3)
    }
  })
})
