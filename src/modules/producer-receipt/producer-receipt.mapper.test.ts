import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import { Unit } from '../../constants/index.js'

import { toPortalProducerReceipt, toProducerReceiptDetail } from './producer-receipt.mapper.js'
import type { ProducerReceiptInput } from './producer-receipt.types.js'

const input = (overrides: Partial<ProducerReceiptInput> = {}): ProducerReceiptInput => ({
  date: '05/09/2026',
  time: '19:38:52',
  producer: { taxOrIdentityNumber: '11111111111', firstName: 'PROBE', lastName: 'MUSTAHSIL' },
  city: 'İstanbul',
  website: 'https://ornek.test',
  note: 'Makbuz notu',
  deliveryDate: '05/09/2026',
  lineItems: [
    {
      name: 'Ceviz',
      quantity: 10,
      unit: Unit.KILOGRAM,
      unitPrice: 100,
      taxRates: {
        incomeTaxWithholding: 2,
        pastureFund: 1,
        stockExchangeRegistration: 0.5,
        socialSecurityPremium: 1,
      },
    },
  ],
  ...overrides,
})

describe('toPortalProducerReceipt', () => {
  it('kimlik alanlarını ASLA göndermez — ETTN portal tarafından atanır', () => {
    const payload = toPortalProducerReceipt(input())
    expect(payload).not.toHaveProperty('uuid')
    expect(payload).not.toHaveProperty('ettn')
    expect(payload).not.toHaveProperty('faturaUuid')
  })

  it('gövde alanlarını portalın Türkçe adlarına eşler', () => {
    const payload = toPortalProducerReceipt(input())
    expect(payload.vknTckn).toBe('11111111111')
    expect(payload.aliciAdi).toBe('PROBE')
    expect(payload.aliciSoyadi).toBe('MUSTAHSIL')
    expect(payload.tarih).toBe('05/09/2026')
    expect(payload.saat).toBe('19:38:52')
    expect(payload.sehir).toBe('İstanbul')
    expect(payload.websitesi).toBe('https://ornek.test')
    expect(payload.not).toBe('Makbuz notu')
    expect(payload.teslimTarih).toBe('05/09/2026')
    expect(payload.belgeNumarasi).toBe('')
  })

  it('toplam alanı portalın küçük "h" yazımını kullanır', () => {
    // Portalın kendi yazımı `malhizmetToplamTutari` (küçük h); kalem alanı
    // ise `malHizmetTutari` (büyük H). Camel-case'e "düzeltilmiş" bir anahtar
    // portalda sessizce yok sayılırdı.
    const payload = toPortalProducerReceipt(input())
    expect(Object.keys(payload)).toContain('malhizmetToplamTutari')
    expect(Object.keys(payload)).not.toContain('malHizmetToplamTutari')
    expect(payload.malhizmetToplamTutari).toBe('1000.00')
    expect(payload.vergilerDahilToplamTutar).toBe('1000.00')
    // 1000 − (20 + 10 + 5 + 10) = 955
    expect(payload.odenecekTutar).toBe('955.00')
  })

  it('kalemi mustahsilTable içinde dört vergi ÇİFTİYLE gönderir', () => {
    const table = toPortalProducerReceipt(input()).mustahsilTable as Record<string, unknown>[]
    expect(table).toHaveLength(1)
    expect(table[0]).toEqual({
      malHizmet: 'Ceviz',
      miktar: 10,
      birim: 'KGM',
      birimFiyat: '100.00',
      malHizmetTutari: '1000.00',
      v0003Orani: 2,
      v0003Tutari: '20.00',
      v9040Orani: 1,
      v9040Tutari: '10.00',
      v8001Orani: 0.5,
      v8001Tutari: '5.00',
      vSGK_PRIMOrani: 1,
      vSGK_PRIMTutari: '10.00',
    })
  })

  it('belge düzeyi hesaplanan vergi alanlarını GÖNDERMEZ — portal kalemlerden türetiyor', () => {
    // Canlı doğrulama: `hesaplanan*` alanları gönderilmeden oluşturulan
    // makbuz geri okunduğunda bu alanlar doğru değerlerle döndü.
    const payload = toPortalProducerReceipt(input())
    for (const field of [
      'hesaplananv0003',
      'hesaplananv9040',
      'hesaplananv8001',
      'hesaplananvSGK_PRIMTutari',
    ]) {
      expect(payload).not.toHaveProperty(field)
    }
  })

  it('opsiyonel metin alanlarını boş string olarak doldurur', () => {
    const { city, website, note, deliveryDate, ...withoutOptionals } = input()
    void city
    void website
    void note
    void deliveryDate
    const payload = toPortalProducerReceipt(withoutOptionals)
    for (const field of ['sehir', 'websitesi', 'not', 'belgeNumarasi']) {
      expect(payload[field], `${field} boş string olmalı`).toBe('')
    }
    // teslimTarih verilmezse belge tarihine düşer; portal boş string kabul
    // etmiyor olabilir ve tarih alanı zaten her zaman bilinir.
    expect(payload.teslimTarih).toBe(payload.tarih)
  })
})

describe('toProducerReceiptDetail', () => {
  const raw = portalResponses.producerReceiptDetail.data as unknown as Record<string, unknown>

  it('canlı yanıttaki SAYISAL tutarları ve `uuid` kimlik alanını okur', () => {
    const detail = toProducerReceiptDetail(raw, 'yedek-ettn')
    expect(detail.ettn).toBe('caf584f7-2b42-4775-b6da-2e4d01bb534d')
    expect(detail.documentNumber).toBe('GIB2026000000014')
    expect(detail.date).toBe('05/09/2026')
    expect(detail.time).toBe('19:38:52')
    expect(detail.producer).toEqual({
      taxOrIdentityNumber: '11111111111',
      firstName: 'PROBE',
      lastName: 'MUSTAHSIL',
    })
    expect(detail.city).toBe('İstanbul')
    expect(detail.website).toBe('https://ornek.test')
    expect(detail.deliveryDate).toBe('05/09/2026')
  })

  it("kimlik alanı yoksa istenen ETTN'e düşer", () => {
    const detail = toProducerReceiptDetail({ ...raw, uuid: undefined }, 'yedek-ettn')
    expect(detail.ettn).toBe('yedek-ettn')
  })

  it('portalın `not` alanına EKLEDİĞİ sondaki satır sonunu kırpar', () => {
    // Canlı doğrulama: gönderilen "Makbuz notu", "Makbuz notu\n" olarak
    // dönüyor. Kırpılmazsa her round-trip karşılaştırması yanlış negatif olur.
    expect(raw.not).toBe('Makbuz notu\n')
    expect(toProducerReceiptDetail(raw, 'x').note).toBe('Makbuz notu')
  })

  it('kalem vergilerini kendi oran/tutar çiftlerinden okur', () => {
    const [line] = toProducerReceiptDetail(raw, 'x').lineItems
    expect(line).toMatchObject({
      name: 'Ceviz',
      quantity: 10,
      unit: 'KGM',
      unitPrice: 100,
      amount: 1000,
      totalTaxes: 45,
    })
    expect(line?.taxRates).toEqual({
      incomeTaxWithholding: 2,
      pastureFund: 1,
      stockExchangeRegistration: 0.5,
      socialSecurityPremium: 1,
    })
    expect(line?.taxAmounts).toEqual({
      incomeTaxWithholding: 20,
      pastureFund: 10,
      stockExchangeRegistration: 5,
      socialSecurityPremium: 10,
    })
  })

  it('belge düzeyi vergi toplamlarını ASİMETRİK portal adlarından okur', () => {
    // Dördüncü alanın adı `hesaplananvSGK_PRIMTutari` — diğer üçünden FARKLI
    // olarak `Tutari` ekiyle bitiyor. `hesaplananv${kod}` şeklinde türetilmiş
    // bir okuma bu alanı sessizce kaçırıp 0 raporlardı.
    expect(Object.keys(raw)).toContain('hesaplananvSGK_PRIMTutari')
    expect(Object.keys(raw)).not.toContain('hesaplananvSGK_PRIM')
    expect(toProducerReceiptDetail(raw, 'x').totals.taxAmounts).toEqual({
      incomeTaxWithholding: 20,
      pastureFund: 10,
      stockExchangeRegistration: 5,
      socialSecurityPremium: 10,
    })
  })

  it('PORTALIN KENDİ toplamlarını raporlar, kalemlerden yeniden hesaplamaz', () => {
    // Canlı kanıt: `odenecekTutar` 77,77 olarak GÖNDERİLDİ ve portal onu
    // saklandığı gibi geri verdi; aritmetik olarak doğrusu 98,00. Okuma yolu
    // yeniden hesaplasaydı 98 raporlar ve GİB'in kayıtlı rakamıyla
    // çelişirdi — bu test o farkı ayırt eder.
    const stored = portalResponses.producerReceiptDetailStoredWrongTotals.data as unknown as Record<
      string,
      unknown
    >
    const detail = toProducerReceiptDetail(stored, 'x')
    expect(detail.totals.lineTotal).toBe(100)
    expect(detail.totals.totalTaxes).toBe(2)
    expect(detail.totals.payableAmount).toBe(77.77)
  })

  it('bozuk tarih alanında FIRLATMAZ, ham değeri geri verir', () => {
    const detail = toProducerReceiptDetail({ ...raw, tarih: '' }, 'x')
    expect(detail.date).toBe('')
  })
})
