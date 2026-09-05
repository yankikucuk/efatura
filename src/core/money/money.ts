import { EArsivValidationError } from '../errors/index.js'

/** Bir kuruşun altındaki hassasiyet portalda yok; her şey tam sayı kuruş. */
const MINOR_UNITS_PER_MAJOR = 100

/**
 * Yarımı sıfırdan uzağa yuvarlar. `Math.round` negatiflerde +sonsuza doğru
 * yuvarladığı için (-2.5 -> -2) doğrudan kullanılamaz.
 */
function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new EArsivValidationError(`${label} sonlu bir sayı olmalı.`, [
      { path: label, message: `Geçersiz sayısal değer: ${String(value)}` },
    ])
  }
}

/**
 * Lira cinsinden değeri tam sayı kuruşa çevirir.
 *
 * `value * 100` kayan nokta artığı bırakır (0.615 * 100 = 61.499999999999996).
 * `toPrecision(15)` bu artığı temizler; 15 anlamlı basamak, IEEE-754 çift
 * hassasiyetin güvenilir sınırının hemen altındadır.
 *
 * @param value Lira cinsinden tutar. Sonlu bir sayı olmalı; `NaN` veya
 *   `Infinity` reddedilir. Negatif değerler desteklenir (yarım, sıfırdan
 *   UZAĞA yuvarlanır: -0,125 → -13).
 * @returns Tam sayı kuruş.
 * @throws {EArsivValidationError} `value` sonlu bir sayı değilse.
 *
 * @example
 * ```ts
 * import { toMinor } from 'efatura'
 *
 * console.log(toMinor(100)) // 10000
 * console.log(toMinor(1.5)) // 150
 * // Kayan nokta artığı temizlenir: 0.615 * 100 = 61.499999999999996
 * console.log(toMinor(0.615)) // 62
 * ```
 */
export function toMinor(value: number): number {
  assertFinite(value, 'tutar')
  const scaled = Number((value * MINOR_UNITS_PER_MAJOR).toPrecision(15))
  return roundHalfAwayFromZero(scaled)
}

/**
 * Kuruşu lira cinsinden sayıya çevirir.
 *
 * @param minor Tam sayı kuruş.
 * @returns Lira cinsinden sayı (100'e bölünmüş hâli). Doğrulama YAPMAZ:
 *   girdi zaten `toMinor`/`applyPercent` çıktısı olduğu için sonludur.
 *
 * @example
 * ```ts
 * import { fromMinor } from 'efatura'
 *
 * console.log(fromMinor(10_000)) // 100
 * console.log(fromMinor(150)) // 1.5
 * ```
 */
export function fromMinor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR
}

/**
 * Portalın beklediği iki ondalıklı string biçimi.
 *
 * Ondalık ayırıcı NOKTADIR (portalın yükte beklediği biçim), okuma yolundaki
 * Türkçe virgüllü biçim değil.
 *
 * @param minor Tam sayı kuruş. Negatif değerlerde başa `-` konur.
 * @returns Her zaman iki ondalık basamaklı metin, ör. `'120.00'`, `'0.05'`,
 *   `'-1.50'`.
 *
 * @example
 * ```ts
 * import { formatMinor, toMinor } from 'efatura'
 *
 * console.log(formatMinor(toMinor(120))) // '120.00'
 * console.log(formatMinor(5)) // '0.05'
 * ```
 */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const absolute = Math.abs(minor)
  const major = Math.trunc(absolute / MINOR_UNITS_PER_MAJOR)
  const remainder = absolute % MINOR_UNITS_PER_MAJOR
  return `${sign}${String(major)}.${String(remainder).padStart(2, '0')}`
}

/**
 * Kuruş tutarının yüzdesini kuruş olarak döndürür. `percent` 0–100 arasıdır.
 *
 * @param minor Yüzdesi alınacak tam sayı kuruş tutarı.
 * @param percent Yüzde değeri, 0 ile 100 ARASINDA (kesir değil: %20 için
 *   `20`). Tam sayı olmak zorunda değildir; ör. `12.5` geçerlidir.
 * @returns Yarım-sıfırdan-uzağa yuvarlanmış tam sayı kuruş.
 * @throws {EArsivValidationError} `percent` sonlu değilse ya da [0, 100]
 *   aralığının dışındaysa.
 *
 * @example
 * ```ts
 * import { applyPercent, toMinor } from 'efatura'
 *
 * console.log(applyPercent(toMinor(100), 20)) // 2000 kuruş = 20 lira
 * // Ondalıklı oranda da kayan nokta artığı temizlenir:
 * console.log(applyPercent(250, 64.6)) // 162
 * ```
 */
export function applyPercent(minor: number, percent: number): number {
  assertFinite(percent, 'oran')
  if (percent < 0 || percent > 100) {
    throw new EArsivValidationError('Oran 0 ile 100 arasında olmalı.', [
      { path: 'oran', message: `Aralık dışı yüzde değeri: ${String(percent)}` },
    ])
  }
  // toMinor ile aynı sapma temizliği: oran tam sayı olmayabilir
  // (ör. %12,5 iskonto) ve o durumda aynı kayan nokta artığı ortaya çıkar.
  return roundHalfAwayFromZero(Number(((minor * percent) / 100).toPrecision(15)))
}

/**
 * Kuruş değerlerini toplar.
 *
 * @param values Tam sayı kuruş değerleri. Boş dizi geçerlidir.
 * @returns Toplam kuruş; boş dizide 0.
 *
 * @example
 * ```ts
 * import { sumMinor, toMinor } from 'efatura'
 *
 * console.log(sumMinor([toMinor(1), toMinor(2), toMinor(3)])) // 600
 * console.log(sumMinor([])) // 0
 * ```
 */
export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
