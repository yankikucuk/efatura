/**
 * Serbest meslek makbuzu aritmetiği — brüt ücret → stopaj → net ücret → KDV →
 * KDV tevkifatı → net alınan zinciri.
 *
 * Bu zincirin formülleri hiçbir portal yanıtından TÜRETİLEMEDİ: portal makbuz
 * tutarlarını ne hesaplıyor ne doğruluyor (`netUcret`/`netAlinan`
 * gönderilmediğinde bunları hesaplamayıp 0 olarak SAKLIYOR — canlı
 * doğrulandı). Yani yanlış bir formül sessizce yanlış bir hukuki belge üretir
 * ve portal itiraz etmez. Formüller mevzuattaki standart SMM hesabına göre
 * yazıldı ve zincirin HER adımı ayrı bir testle sabitlendi.
 *
 * İki test bilinçli olarak "en kolay yapılan hata"yı pinler ve AYIRT EDİCİ
 * değerlerle yazılmıştır:
 * - KDV matrahı BRÜT ücrettir, net ücret DEĞİL. Net üzerinden hesaplansaydı
 *   160 çıkardı; doğrusu 200. (Mutasyon denetimi: ters çevrildiğinde 11 test
 *   kırılıyor.)
 * - KDV tevkifatı KDV TUTARININ yüzdesidir, brüt ücretin değil. Brüt üzerinden
 *   hesaplansaydı 200 çıkardı; doğrusu 40.
 *
 * AÇIK KALAN BELİRSİZLİK: `kdvTevkifatOrani` alanının BİRİMİ. Mevzuat oranı
 * kesirle anıyor (5/10); kütüphane yüzde (0–100) olarak modelledi, portal `50`
 * değerini kabul edip aynen geri verdi — ama portal bu alanı doğrulamadığı
 * için "5" gönderilseydi de kabul ederdi. Yani bu seçim portal tarafından
 * KANITLANMIŞ değildir ve gerçek bir mükellef ekranıyla teyit edilmelidir.
 */

import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../../core/index.js'

import {
  computeSelfEmployedReceiptLineItem,
  computeSelfEmployedReceiptLineItemForRead,
  computeSelfEmployedReceiptTotals,
  sumSelfEmployedReceiptTotals,
} from './self-employed-receipt.totals.js'
import type { SelfEmployedReceiptLineItemInput } from './self-employed-receipt.types.js'

const item = (
  overrides: Partial<SelfEmployedReceiptLineItemInput> = {},
): SelfEmployedReceiptLineItemInput => ({
  description: 'Danışmanlık',
  grossFee: 1000,
  vatRate: 20,
  withholdingRate: 20,
  ...overrides,
})

describe('computeSelfEmployedReceiptLineItem', () => {
  // Kapsam: altı adımlı zincirin her halkası. KDV matrahı ve tevkifat tabanı
  // ayrı ayrı, ayırt edici değerlerle pinlenir.
  it('brüt ücret → stopaj → net ücret → KDV → tevkifat → net alınan zincirini uygular', () => {
    const computed = computeSelfEmployedReceiptLineItem(item({ vatWithholdingRate: 50 }))
    expect(computed).toMatchObject({
      withholdingAmount: 200,
      netFee: 800,
      vatAmount: 200,
      vatWithholdingAmount: 100,
      collectedVat: 100,
      netReceived: 900,
    })
  })

  it('KDV matrahı BRÜT ücrettir, net ücret DEĞİL', () => {
    // Ayırt edici: KDV net ücret (800) üzerinden hesaplansaydı 160 çıkardı.
    // Bu, serbest meslek makbuzunda en kolay yapılan hatadır.
    expect(computeSelfEmployedReceiptLineItem(item()).vatAmount).toBe(200)
  })

  it('stopaj oranı verilmezse sıfır sayılır ve net ücret brüte eşit olur', () => {
    const { withholdingRate, ...withoutRates } = item()
    void withholdingRate
    const computed = computeSelfEmployedReceiptLineItem(withoutRates)
    expect(computed.withholdingAmount).toBe(0)
    expect(computed.netFee).toBe(1000)
    expect(computed.vatAmount).toBe(200)
    expect(computed.vatWithholdingAmount).toBe(0)
    expect(computed.collectedVat).toBe(200)
    expect(computed.netReceived).toBe(1200)
  })

  it('KDV tevkifatı KDV tutarının yüzdesidir, brüt ücretin değil', () => {
    // Ayırt edici: tevkifat brüt ücret üzerinden hesaplansaydı 1000 × %20 =
    // 200 çıkardı; doğrusu KDV'nin (200) %20'si = 40.
    const computed = computeSelfEmployedReceiptLineItem(item({ vatWithholdingRate: 20 }))
    expect(computed.vatWithholdingAmount).toBe(40)
    expect(computed.collectedVat).toBe(160)
  })

  it('kuruş hassasiyetinde yuvarlar', () => {
    // 333,33 × %20 = 66,666 -> 66,67
    const computed = computeSelfEmployedReceiptLineItem(
      item({ grossFee: 333.33, withholdingRate: 20, vatRate: 20 }),
    )
    expect(computed.withholdingAmount).toBe(66.67)
    expect(computed.netFee).toBe(266.66)
    expect(computed.vatAmount).toBe(66.67)
  })

  it('geçersiz kalemde hata fırlatır', () => {
    expect(() => computeSelfEmployedReceiptLineItem(item({ description: '  ' }))).toThrow(
      EArsivValidationError,
    )
    expect(() => computeSelfEmployedReceiptLineItem(item({ grossFee: -1 }))).toThrow(
      EArsivValidationError,
    )
  })

  it('hata yolu kalem indeksini taşır', () => {
    try {
      computeSelfEmployedReceiptLineItem(item({ description: '' }), 2)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues[0]?.path).toBe('lineItems.2.description')
    }
  })
})

describe('computeSelfEmployedReceiptLineItemForRead', () => {
  // Kapsam: aynı zincirin DOĞRULAMASIZ hâli. Okuma yolu ayrı bir fonksiyondur
  // çünkü portaldan gelen bir kaydı reddetmek yanlıştır: kullanıcı var olan
  // bir belgeyi okuyor, yeni bir belge oluşturmuyor — reddetmek onu `raw`
  // alanına erişmekten bile alıkoyardı (faturadaki I4 kararının aynısı).
  it('okuma yolunda doğrulama YAPMADAN aynı zinciri uygular', () => {
    // Portaldan gelen bir kaydı reddetmek çağıranın `raw`'a erişimini bile
    // engellerdi (faturadaki I4 kararının aynısı).
    expect(() =>
      computeSelfEmployedReceiptLineItemForRead(item({ description: '', grossFee: -5 })),
    ).not.toThrow()
    // item(): brüt 1000, stopaj %20 = 200, net ücret 800, KDV 200,
    // tevkifat yok -> net alınan 1000.
    expect(computeSelfEmployedReceiptLineItemForRead(item()).netReceived).toBe(1000)
  })
})

describe('computeSelfEmployedReceiptTotals', () => {
  // Kapsam: yedi belge toplamının kalemlerden türetilmesi ve çok kalemli
  // makbuzda her toplamın AYRI AYRI toplanması.
  it('yedi belge toplamını kalemlerden türetir', () => {
    const { totals } = computeSelfEmployedReceiptTotals([item({ vatWithholdingRate: 50 })])
    expect(totals).toEqual({
      grossFee: 1000,
      withholding: 200,
      netFee: 800,
      vat: 200,
      vatWithholding: 100,
      collectedVat: 100,
      netReceived: 900,
    })
  })

  it('birden fazla kalemi ayrı ayrı toplar', () => {
    const { totals } = computeSelfEmployedReceiptTotals([
      item(),
      item({ description: 'Mimarlık', grossFee: 500, vatRate: 10, withholdingRate: 0 }),
    ])
    expect(totals.grossFee).toBe(1500)
    expect(totals.withholding).toBe(200)
    expect(totals.netFee).toBe(1300)
    expect(totals.vat).toBe(250)
    expect(totals.netReceived).toBe(1550)
  })

  it('boş kalem listesinde hata fırlatır', () => {
    expect(() => computeSelfEmployedReceiptTotals([])).toThrow(EArsivValidationError)
  })
})

describe('sumSelfEmployedReceiptTotals', () => {
  // Kapsam: okuma yolunda hesaplanmış kalemlerden yeniden toplamanın
  // oluşturma yoluyla aynı sonucu vermesi.
  it('hesaplanmış kalemlerden aynı toplamları üretir', () => {
    const { lines, totals } = computeSelfEmployedReceiptTotals([item({ vatWithholdingRate: 50 })])
    expect(sumSelfEmployedReceiptTotals(lines)).toEqual(totals)
  })
})
