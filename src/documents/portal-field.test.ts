/**
 * Portal alanlarını okuyan ilkeller: `str`, `num`, `asRows`.
 *
 * Portal aynı alanı vakaya göre string, sayı, `null` ya da hiç göndermeyerek
 * döndürüyor; bu üç yardımcı o düzensizliği tek yerde soğuruyor. Daha önce
 * `invoice.mapper` ve `document.mapper` içinde AYRI AYRI duruyorlardı ("kasıtlı
 * kopya" olarak belgelenmişti); iki makbuz modülü de aynı ilkellere ihtiyaç
 * duyunca kopya sayısı dörde çıkacaktı ve `documents` yaprak katmanına
 * taşındılar.
 *
 * Süitin en değerli iki iddiası:
 * - `str('')` varsayılana DÜŞMEZ; boş string geçerli bir stringtir. Bu kör
 *   nokta I5'in kök sebebiydi: portalın boş `belgeTarihi` gönderdiği TEK bir
 *   satır, `formatPortalDate('')` fırlattığı için listenin TAMAMINI
 *   düşürüyordu.
 * - `num` hem Türkçe biçimli stringi ("1.234,56") hem de ham sayıyı kabul
 *   eder — makbuz detay yanıtları tutarları STRING değil SAYI döndürüyor
 *   (canlı doğrulandı), faturanın aksine.
 */

import { describe, expect, it } from 'vitest'

import { asRows, num, str } from './portal-field.js'

describe('str', () => {
  // Kapsam: string/sayı dışındaki her girdinin varsayılana düşmesi — ve boş
  // stringin bu kuralın DIŞINDA kalması.
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
  // Kapsam: portalın iki ayrı sayı gösterimi (Türkçe biçimli string ve ham
  // sayı) ve ayrıştırılamayan girdide fallback.
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
  // Kapsam: liste yanıtlarının güvenli hâle getirilmesi. Portal boş sonucu
  // bazen `null`, hata durumunda ise düz metin olarak döndürüyor; koruma
  // olmadan çağıran `.map()` üzerinde `TypeError` alırdı.
  //
  // DİKKAT: bu blok dizi OLMAYAN girdilerle yazılmak zorunda. `[]` ile
  // yazılmış bir "boş listeyi tolere eder" testi hiçbir şey kanıtlamaz —
  // `[]` zaten geçerli bir dizidir ve `Array.isArray` koruması silinse de
  // geçerdi. Bu tuzağa dispute.service.test.ts'te düşüldü ve düzeltildi.
  it('diziyi satır listesine çevirir', () => {
    expect(asRows([{ a: 1 }])).toEqual([{ a: 1 }])
  })

  it('dizi olmayan yanıtta boş liste döner', () => {
    expect(asRows(null)).toEqual([])
    expect(asRows(undefined)).toEqual([])
    expect(asRows('hata')).toEqual([])
  })
})
