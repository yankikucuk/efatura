/**
 * Para aritmetiği — tam sayı KURUŞ üzerinden.
 *
 * Bu dosyadaki hesap doğrudan hukuki belgeye yazılır: bir kuruşluk sapma
 * portalın kendi rakamıyla uyuşmazlığa, uyuşmazlık reddedilen ya da yanlış
 * belgeye yol açar. Bu yüzden tüm işlemler kuruş (tam sayı) düzleminde yapılır
 * ve liraya yalnızca çıktı anında dönülür.
 *
 * Sabitlenen asıl hata sınıfı ikili kayan nokta artığıdır:
 * `0.615 * 100 = 61.499999999999996` ve saf `Math.round` bir kuruş EKSİK (61)
 * verir. `toMinor` ve `applyPercent` bu artığı temizler.
 *
 * DİKKAT — bu süitte test DEĞERLERİ özenle seçilmiştir. "Ondalıklı oranlarda
 * kayan nokta artığını temizler" testi ilk yazıldığında 2470×%12,5 ve
 * 1150×%8,1 kullanıyordu; bu iki çarpım ikili kayan noktada TAM temsil
 * edildiği için test, temizlik HİÇ YAPILMASA DA geçiyordu — yani adını
 * taşıdığı davranışı sabitlemiyordu (projede yakalanan yedi böyle vakadan
 * biri). Değerler, temizlik olmadan ve olduğunda FARKLI sonuç veren üç girdiyle
 * değiştirildi (250×%64,6 → 161/162, 375×%9,2 → 34/35, 1875×%16,4 → 307/308) ve
 * ayırt edicilik deneyle doğrulandı: `toPrecision(15)` geçici olarak
 * kaldırılınca test "expected 161 to be 162" ile kırmızı oluyor.
 *
 * Bu süite yeni bir yuvarlama vakası eklerken AYNI kontrolü yapın: seçtiğiniz
 * sayılar ikili olarak tam temsil ediliyorsa test hiçbir şey kanıtlamaz.
 */

import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../errors/index.js'

import { applyPercent, formatMinor, fromMinor, sumMinor, toMinor } from './index.js'

describe('toMinor', () => {
  // Kapsam: liraya bakan giriş kapısı. Kullanıcı ondalıklı lira verir, tüm
  // hesap kuruşta yapılır. "Yarımı sıfırdan uzağa" yuvarlama negatif
  // tutarlarda (iade) da simetrik olmalıdır.
  it('lirayı kuruşa çevirir', () => {
    expect(toMinor(100)).toBe(10_000)
    expect(toMinor(1.5)).toBe(150)
    expect(toMinor(0)).toBe(0)
  })

  it('kayan nokta artığını temizler', () => {
    // 0.615 * 100 = 61.499999999999996 — saf Math.round 61 verirdi.
    expect(toMinor(0.615)).toBe(62)
    // 1.005 * 100 = 100.49999999999999 — saf Math.round 100 verirdi.
    expect(toMinor(1.005)).toBe(101)
  })

  it('yarımı sıfırdan uzağa yuvarlar', () => {
    expect(toMinor(0.125)).toBe(13)
    expect(toMinor(-0.125)).toBe(-13)
  })

  it('sonlu olmayan değerde hata fırlatır', () => {
    expect(() => toMinor(Number.NaN)).toThrow(EArsivValidationError)
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(EArsivValidationError)
  })
})

describe('fromMinor ve formatMinor', () => {
  // Kapsam: çıkış kapısı. `formatMinor`'ın İKİ ondalıklı ve NOKTA ayırıcılı
  // olması zorunlu: portal yükte "1234.56" bekler, okuma yanıtlarında ise
  // "1.234,56" döndürür (okuma tarafı için bkz. documents/portal-field).
  it('kuruşu liraya çevirir', () => {
    expect(fromMinor(10_000)).toBe(100)
    expect(fromMinor(150)).toBe(1.5)
  })

  it('portal için iki ondalıklı string üretir', () => {
    expect(formatMinor(12_000)).toBe('120.00')
    expect(formatMinor(5)).toBe('0.05')
    expect(formatMinor(0)).toBe('0.00')
    expect(formatMinor(-150)).toBe('-1.50')
  })
})

describe('applyPercent', () => {
  // Kapsam: tek yüzde uygulama noktası. KDV, iskonto, gelir vergisi stopajı,
  // mera fonu, borsa tescil ücreti, SGK primi ve KDV tevkifatı — hepsi
  // buradan geçer, yani buradaki bir kuruşluk sapma HER belge türünü etkiler.
  it('yüzdeyi kuruş üzerinden uygular', () => {
    expect(applyPercent(10_000, 20)).toBe(2_000)
    expect(applyPercent(10_000, 0)).toBe(0)
    expect(applyPercent(9_900, 20)).toBe(1_980)
  })

  it('sonucu yarım-yukarı yuvarlar', () => {
    // 333 kuruşun %1'i = 3.33 -> 3
    expect(applyPercent(333, 1)).toBe(3)
    // 350 kuruşun %1'i = 3.5 -> 4
    expect(applyPercent(350, 1)).toBe(4)
  })

  it('ondalıklı oranlarda kayan nokta artığını temizler', () => {
    // Bu değerler sapma temizliği OLMADAN farklı sonuç verir; testin
    // korumayı gerçekten sabitlemesi için ayırt edici olmaları şart.
    // 250 x 64.6 / 100 = 161.49999999999997 -> temizlik yoksa 161, varsa 162
    expect(applyPercent(250, 64.6)).toBe(162)
    // 375 x 9.2 / 100 = 34.499999999999996 -> temizlik yoksa 34, varsa 35
    expect(applyPercent(375, 9.2)).toBe(35)
    // 1875 x 16.4 / 100 = 307.49999999999994 -> temizlik yoksa 307, varsa 308
    expect(applyPercent(1_875, 16.4)).toBe(308)
  })

  it('yüzde aralık dışındaysa hata fırlatır', () => {
    expect(() => applyPercent(100, -1)).toThrow(EArsivValidationError)
    expect(() => applyPercent(100, 101)).toThrow(EArsivValidationError)
  })
})

describe('sumMinor', () => {
  // Kapsam: toplamanın tam sayı üzerinden yapıldığı. Küçük ama gerekli:
  // toplamanın lira düzlemine "iyileştirilmesini" engelleyen kayıt budur.
  it('toplar', () => {
    expect(sumMinor([100, 200, 300])).toBe(600)
    expect(sumMinor([])).toBe(0)
  })
})
