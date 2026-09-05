/**
 * Fatura aritmetiği ve `totals` override doğrulaması.
 *
 * Toplamlar KALEMLERDEN türetilir; çağıranın matrah/KDV/genel toplam
 * hesaplaması gerekmez. Yine de `totals` ile bir değeri override etmek
 * mümkündür ve asıl güvence buradadır: override HESAPLANANLA KARŞILAŞTIRILIR,
 * uyuşmazsa istek ağa çıkmadan reddedilir. En sinsi vaka tek bir alanı
 * "düzeltmeye" çalışan çağırandır — bu kontrol olmadan uydurulmuş bir KDV
 * doğrudan hukuki belgeye yazılırdı.
 *
 * `computeLineItemForRead` ayrı bir fonksiyondur çünkü OKUMA yolu doğrulama
 * yapmamalıdır (I4): `getInvoice` portalda ZATEN var olan bir kaydı getiriyor;
 * boş ada veya negatif miktara sahip bir satır yüzünden fırlatmak kullanıcıyı
 * kendi faturasını okuyamaz hâle getirirdi — `raw` alanına bile erişemezdi.
 *
 * Yuvarlama vakaları kuruş düzleminde yazılmıştır; ilgili kayan nokta tuzağı
 * ve test değerlerinin nasıl seçilmesi gerektiği için bkz.
 * `src/core/money/money.test.ts` başlığı.
 */

import { describe, expect, it } from 'vitest'

import { Unit } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import {
  computeLineItem,
  computeLineItemForRead,
  computeTotals,
  mergeAndVerifyTotals,
} from './invoice.totals.js'
import type { LineItemInput } from './invoice.types.js'

const item = (overrides: Partial<LineItemInput> = {}): LineItemInput => ({
  name: 'Yazılım Geliştirme',
  quantity: 1,
  unit: Unit.PIECE,
  unitPrice: 100,
  vatRate: 20,
  ...overrides,
})

describe('computeLineItem', () => {
  // Kapsam: kalem düzeyi zincir — brüt → iskonto → net → KDV → ek vergi,
  // kuruş hassasiyetiyle + yerel doğrulama.
  it('iskontosuz kalemi hesaplar', () => {
    expect(computeLineItem(item())).toMatchObject({
      grossAmount: 100,
      discountAmount: 0,
      netAmount: 100,
      vatAmount: 20,
      additionalTaxAmount: 0,
    })
  })

  it('miktar ile çarpar', () => {
    expect(computeLineItem(item({ quantity: 28, unitPrice: 3 }))).toMatchObject({
      grossAmount: 84,
      netAmount: 84,
      vatAmount: 16.8,
    })
  })

  it('iskontoyu KDV öncesi uygular', () => {
    expect(computeLineItem(item({ unitPrice: 100, discountRate: 10 }))).toMatchObject({
      grossAmount: 100,
      discountAmount: 10,
      netAmount: 90,
      vatAmount: 18,
    })
  })

  it('ek vergiyi net tutar üzerinden hesaplar', () => {
    expect(computeLineItem(item({ additionalTaxRate: 5 }))).toMatchObject({
      netAmount: 100,
      additionalTaxAmount: 5,
    })
  })

  it('kuruş hassasiyetinde yuvarlar', () => {
    // 3 × 33.33 = 99.99; %20 KDV = 19.998 -> 20.00
    expect(computeLineItem(item({ quantity: 3, unitPrice: 33.33 }))).toMatchObject({
      grossAmount: 99.99,
      vatAmount: 20,
    })
  })

  it('sıfır KDV oranını kabul eder', () => {
    expect(computeLineItem(item({ vatRate: 0 })).vatAmount).toBe(0)
  })

  it('negatif miktarda hata fırlatır', () => {
    expect(() => computeLineItem(item({ quantity: -1 }))).toThrow(EArsivValidationError)
  })

  it('negatif birim fiyatta hata fırlatır', () => {
    expect(() => computeLineItem(item({ unitPrice: -5 }))).toThrow(EArsivValidationError)
  })

  it('boş kalem adında hata fırlatır', () => {
    expect(() => computeLineItem(item({ name: '   ' }))).toThrow(EArsivValidationError)
  })
})

describe('computeLineItemForRead (I4)', () => {
  // Kapsam: aynı zincirin DOĞRULAMASIZ hâli ve geçerli girdide oluşturma
  // yoluyla aynı sonucu verdiği.
  it('doğrulama yapmadan boş ada sahip bir kalemi hesaplar', () => {
    // Okuma yolu (getInvoice) portaldan gelen bir satırı REDDETMEMELİ:
    // kullanıcı zaten var olan bir kaydı okuyor, yeni bir kayıt oluşturmuyor.
    expect(() => computeLineItemForRead(item({ name: '' }))).not.toThrow()
    expect(computeLineItemForRead(item({ name: '' }))).toMatchObject({ name: '' })
  })

  it('negatif miktar veya birim fiyatta da hata fırlatmaz', () => {
    expect(() => computeLineItemForRead(item({ quantity: -1 }))).not.toThrow()
    expect(() => computeLineItemForRead(item({ unitPrice: -5 }))).not.toThrow()
  })

  it('geçerli bir kalemde computeLineItem ile aynı tutarları üretir', () => {
    expect(computeLineItemForRead(item())).toMatchObject({
      grossAmount: 100,
      discountAmount: 0,
      netAmount: 100,
      vatAmount: 20,
      additionalTaxAmount: 0,
    })
  })
})

describe('computeTotals', () => {
  // Kapsam: belge düzeyi toplamlar, farklı KDV oranlarının ayrı ayrı
  // hesaplanması ve kalem toplamlarıyla tutarlılık.
  it('tek kalemli faturayı toplar', () => {
    const { totals } = computeTotals([item()])
    expect(totals).toEqual({
      lineTotal: 100,
      totalDiscount: 0,
      taxBase: 100,
      calculatedVat: 20,
      additionalTaxes: 0,
      totalTaxes: 20,
      grandTotal: 120,
      payableAmount: 120,
    })
  })

  it('farklı KDV oranlarını ayrı ayrı hesaplar', () => {
    const { totals } = computeTotals([
      item({ unitPrice: 100, vatRate: 20 }),
      item({ name: 'Kitap', unitPrice: 50, vatRate: 1 }),
    ])
    expect(totals.taxBase).toBe(150)
    expect(totals.calculatedVat).toBe(20.5)
    expect(totals.grandTotal).toBe(170.5)
  })

  it('iskontoları toplar', () => {
    const { totals } = computeTotals([
      item({ unitPrice: 100, discountRate: 10 }),
      item({ name: 'Danışmanlık', unitPrice: 200, discountRate: 25 }),
    ])
    expect(totals.lineTotal).toBe(300)
    expect(totals.totalDiscount).toBe(60)
    expect(totals.taxBase).toBe(240)
  })

  it('ek vergiyi toplam vergiye ekler', () => {
    const { totals } = computeTotals([item({ additionalTaxRate: 5 })])
    expect(totals.calculatedVat).toBe(20)
    expect(totals.additionalTaxes).toBe(5)
    expect(totals.totalTaxes).toBe(25)
    expect(totals.grandTotal).toBe(125)
  })

  it('kalemlerin toplamı fatura toplamına eşittir', () => {
    const { lines, totals } = computeTotals([
      item({ quantity: 3, unitPrice: 33.33 }),
      item({ name: 'Bakım', quantity: 7, unitPrice: 14.29, vatRate: 10 }),
    ])
    const netSum = lines.reduce((sum, line) => sum + line.netAmount, 0)
    expect(Number(netSum.toFixed(2))).toBe(totals.taxBase)
  })

  it('boş kalem listesinde hata fırlatır', () => {
    expect(() => computeTotals([])).toThrow(EArsivValidationError)
  })
})

describe('mergeAndVerifyTotals', () => {
  // Kapsam: `totals` override'ının hesaplanana karşı doğrulanması —
  // kütüphanenin uydurulmuş bir rakamı portala geçirmeyi reddettiği yer. Hata
  // mesajının hem hesaplananı hem verileni içermesi de pinlenir; aksi halde
  // çağıran neyi düzelteceğini bilemezdi.
  it('override verilmediğinde hesaplananı döndürür', () => {
    const { totals } = computeTotals([item()])
    expect(mergeAndVerifyTotals(totals, undefined)).toEqual(totals)
  })

  it('tutarlı override kabul edilir', () => {
    const { totals } = computeTotals([item()])
    expect(mergeAndVerifyTotals(totals, { payableAmount: 120 })).toEqual(totals)
  })

  it('yalnızca KDV override edilirse reddedilir', () => {
    // En sinsi vaka: tek bir alanı düzeltmeye çalışan çağıran. Bu kontrol
    // olmadan uydurulan KDV doğrudan portala giderdi.
    const { totals } = computeTotals([item()])
    expect(() => mergeAndVerifyTotals(totals, { calculatedVat: 999 })).toThrow(
      EArsivValidationError,
    )
  })

  it('kuruşa hizalanmamış override reddedilir', () => {
    const { totals } = computeTotals([item()])
    expect(() => mergeAndVerifyTotals(totals, { payableAmount: 120.004 })).toThrow(
      EArsivValidationError,
    )
  })

  it('eşitliği bozan override hata fırlatır', () => {
    const { totals } = computeTotals([item()])
    expect(() => mergeAndVerifyTotals(totals, { grandTotal: 999 })).toThrow(EArsivValidationError)
  })

  it('hata mesajı hem hesaplanan hem verilen değeri içerir', () => {
    const { totals } = computeTotals([item()])
    try {
      mergeAndVerifyTotals(totals, { taxBase: 50 })
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      const validation = error as EArsivValidationError
      expect(validation.issues.some((issue) => issue.message.includes('50'))).toBe(true)
    }
  })
})
