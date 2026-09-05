import { describe, expect, it } from 'vitest'

import { asRows, num, str } from './portal-field.js'

describe('str', () => {
  it('stringi aynen, sayıyı metne çevirerek döndürür', () => {
    expect(str('Ceviz')).toBe('Ceviz')
    expect(str(1000)).toBe('1000')
  })

  it('string ve sayı DIŞINDAKİ her şeyde varsayılana düşer', () => {
    expect(str(undefined, 'yok')).toBe('yok')
    expect(str(null, 'yok')).toBe('yok')
    expect(str({ a: 1 }, 'yok')).toBe('yok')
    // Boş string GEÇERLİ bir stringtir; varsayılanı TETİKLEMEZ. Bu kör nokta
    // I5'in kaynağıydı ve normalizeSummaryDate'in var olma sebebidir.
    expect(str('', 'yok')).toBe('')
  })
})

describe('num', () => {
  it('Türkçe binlik/ondalık biçimini ayrıştırır (I4)', () => {
    expect(num('1.234,56')).toBe(1234.56)
    expect(num('1234,56')).toBe(1234.56)
    expect(num('1234.56')).toBe(1234.56)
    expect(num('1234')).toBe(1234)
  })

  it('sayıyı aynen döndürür — makbuz detayları sayı olarak geliyor', () => {
    // Canlı doğrulama 2026-09-05: MUSTAHSIL_GETIR `birimFiyat: 100` (sayı)
    // döndürüyor, faturadaki gibi `"100.00"` (string) değil.
    expect(num(100)).toBe(100)
    expect(num(0.5)).toBe(0.5)
  })

  it('ayrıştırılamayan girdide fallback döner', () => {
    expect(num('abc', 7)).toBe(7)
    expect(num(undefined, 7)).toBe(7)
    expect(num(Number.NaN, 7)).toBe(7)
  })
})

describe('asRows', () => {
  it('diziyi satır listesine çevirir', () => {
    expect(asRows([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it('dizi olmayan yanıtta boş liste döner', () => {
    expect(asRows(null)).toEqual([])
    expect(asRows(undefined)).toEqual([])
    expect(asRows('hata')).toEqual([])
  })
})
