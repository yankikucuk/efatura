/**
 * Müstahsil makbuzu aritmetiği.
 *
 * Portal makbuz tutarlarını NE HESAPLIYOR NE DOĞRULUYOR: kasıtlı yanlış bir
 * `odenecekTutar` (doğrusu 98,00 iken 77,77) canlı olarak gönderildi ve aynen
 * saklanıp geri verildi. Yani bu dosyadaki aritmetik, oluşturulan belgenin
 * doğruluğunun TEK güvencesidir.
 *
 * Belgenin özü şudur: müstahsil makbuzunda vergiler tutara EKLENMEZ, tutardan
 * KESİLİR — `odenecekTutar` = vergiler dahil toplam − dört kesintinin toplamı.
 * Faturadan gelen alışkanlıkla `payableAmount = grandTotal` yazmak buradaki en
 * olası hatadır ve ayrı bir testle pinlenmiştir (mutasyon denetiminde bu
 * değişiklik 3 testi birden kırıyor).
 *
 * AYIRT EDİCİLİK NOTU: dört kesinti oranı testlerde KASITLI olarak birbirinden
 * farklıdır (2 / 1 / 0,5 / 4). Eşit oranlarla yazılmış bir test, oranların
 * birbirine karışmasını — ör. mera fonu oranının borsa tescil ücretine
 * uygulanmasını — ayırt EDEMEZDİ.
 */

import { describe, expect, it } from 'vitest'

import { Unit } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import {
  computeProducerReceiptLineItem,
  computeProducerReceiptTotals,
  sumProducerReceiptTotals,
} from './producer-receipt.totals.js'
import type { ProducerReceiptLineItemInput } from './producer-receipt.types.js'

const item = (
  overrides: Partial<ProducerReceiptLineItemInput> = {},
): ProducerReceiptLineItemInput => ({
  name: 'Ceviz',
  quantity: 10,
  unit: Unit.KILOGRAM,
  unitPrice: 100,
  ...overrides,
})

describe('computeProducerReceiptLineItem', () => {
  // Kapsam: kalem tutarı (miktar × birim fiyat) ve dört kesintinin AYRI AYRI,
  // kendi oranıyla, kalem tutarı üzerinden hesaplanması + yerel doğrulama.
  it('kalem tutarını miktar × birim fiyat olarak hesaplar', () => {
    expect(computeProducerReceiptLineItem(item()).amount).toBe(1000)
  })

  it('dört kesintiyi KENDİ oranıyla ve kalem tutarı üzerinden hesaplar', () => {
    // Dört oran KASITLI olarak birbirinden farklı: oranlar birbirine
    // karışsaydı (ör. mera fonu oranı borsa tesciline uygulansaydı) bu test
    // kırılırdı. Eşit oranlarla yazılmış bir test bunu ayırt edemezdi.
    const computed = computeProducerReceiptLineItem(
      item({
        taxRates: {
          incomeTaxWithholding: 2,
          pastureFund: 1,
          stockExchangeRegistration: 0.5,
          socialSecurityPremium: 4,
        },
      }),
    )

    expect(computed.taxAmounts).toEqual({
      incomeTaxWithholding: 20,
      pastureFund: 10,
      stockExchangeRegistration: 5,
      socialSecurityPremium: 40,
    })
    expect(computed.totalTaxes).toBe(75)
  })

  it('oran verilmeyen kesintiyi sıfır sayar', () => {
    const computed = computeProducerReceiptLineItem(item({ taxRates: { pastureFund: 1 } }))
    expect(computed.taxAmounts).toEqual({
      incomeTaxWithholding: 0,
      pastureFund: 10,
      stockExchangeRegistration: 0,
      socialSecurityPremium: 0,
    })
    expect(computed.totalTaxes).toBe(10)
  })

  it('kuruş hassasiyetinde yuvarlar', () => {
    // 3 × 33,33 = 99,99; %2 stopaj = 1,9998 -> 2,00
    const computed = computeProducerReceiptLineItem(
      item({ quantity: 3, unitPrice: 33.33, taxRates: { incomeTaxWithholding: 2 } }),
    )
    expect(computed.amount).toBe(99.99)
    expect(computed.taxAmounts.incomeTaxWithholding).toBe(2)
  })

  it('boş kalem adında hata fırlatır', () => {
    expect(() => computeProducerReceiptLineItem(item({ name: '   ' }))).toThrow(
      EArsivValidationError,
    )
  })

  it('pozitif olmayan miktarda ve negatif birim fiyatta hata fırlatır', () => {
    expect(() => computeProducerReceiptLineItem(item({ quantity: 0 }))).toThrow(
      EArsivValidationError,
    )
    expect(() => computeProducerReceiptLineItem(item({ unitPrice: -1 }))).toThrow(
      EArsivValidationError,
    )
  })

  it('hata yolu kalem indeksini ve alanı işaret eder', () => {
    try {
      computeProducerReceiptLineItem(item({ name: '' }), 3)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues[0]?.path).toBe('lineItems.3.name')
    }
  })
})

describe('computeProducerReceiptTotals', () => {
  // Kapsam: belge düzeyi toplamlar ve makbuzun ayırt edici kuralı — ödenecek
  // tutar, KESİNTİLER DÜŞÜLMÜŞ tutardır.
  it('belge toplamlarını türetir; ödenecek tutar KESİNTİLER DÜŞÜLMÜŞ tutardır', () => {
    const { totals } = computeProducerReceiptTotals([
      item({ taxRates: { incomeTaxWithholding: 2, pastureFund: 1 } }),
    ])

    expect(totals.lineTotal).toBe(1000)
    expect(totals.grandTotal).toBe(1000)
    expect(totals.totalTaxes).toBe(30)
    // odenecekTutar = vergilerDahilToplamTutar − vergiler toplamı.
    // Bu satır silinip payableAmount = grandTotal yapılsaydı test kırılır.
    expect(totals.payableAmount).toBe(970)
  })

  it('birden fazla kalemi ve kesintileri ayrı ayrı toplar', () => {
    const { totals } = computeProducerReceiptTotals([
      item({ taxRates: { incomeTaxWithholding: 2 } }),
      item({ name: 'Fındık', quantity: 5, unitPrice: 200, taxRates: { pastureFund: 1 } }),
    ])

    expect(totals.lineTotal).toBe(2000)
    expect(totals.taxAmounts).toEqual({
      incomeTaxWithholding: 20,
      pastureFund: 10,
      stockExchangeRegistration: 0,
      socialSecurityPremium: 0,
    })
    expect(totals.payableAmount).toBe(1970)
  })

  it('boş kalem listesinde hata fırlatır', () => {
    expect(() => computeProducerReceiptTotals([])).toThrow(EArsivValidationError)
  })
})

describe('sumProducerReceiptTotals', () => {
  // Kapsam: okuma yolunda hesaplanmış kalemlerden yeniden toplama.
  // `computeProducerReceiptTotals` ile AYNI sonucu vermek zorunda: ayrışsalar
  // aynı makbuz oluşturulurken ve okunurken farklı toplam gösterirdi.
  it('hesaplanmış kalemlerden aynı toplamları üretir', () => {
    const { lines, totals } = computeProducerReceiptTotals([
      item({ taxRates: { socialSecurityPremium: 4 } }),
    ])
    expect(sumProducerReceiptTotals(lines)).toEqual(totals)
  })
})
