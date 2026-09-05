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
 */
export function toMinor(value: number): number {
  assertFinite(value, 'tutar')
  const scaled = Number((value * MINOR_UNITS_PER_MAJOR).toPrecision(15))
  return roundHalfAwayFromZero(scaled)
}

/** Kuruşu lira cinsinden sayıya çevirir. */
export function fromMinor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR
}

/** Portalın beklediği iki ondalıklı string biçimi. */
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const absolute = Math.abs(minor)
  const major = Math.trunc(absolute / MINOR_UNITS_PER_MAJOR)
  const remainder = absolute % MINOR_UNITS_PER_MAJOR
  return `${sign}${String(major)}.${String(remainder).padStart(2, '0')}`
}

/** Kuruş tutarının yüzdesini kuruş olarak döndürür. `percent` 0–100 arasıdır. */
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

/** Kuruş değerlerini toplar. */
export function sumMinor(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
