import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../errors/index.js'

import { applyPercent, formatMinor, fromMinor, sumMinor, toMinor } from './index.js'

describe('toMinor', () => {
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
    // 2470 kuruşun %12,5'i = 308.75 -> 309
    expect(applyPercent(2_470, 12.5)).toBe(309)
    // 1150 kuruşun %8,1'i = 93.15 -> 93
    expect(applyPercent(1_150, 8.1)).toBe(93)
  })

  it('yüzde aralık dışındaysa hata fırlatır', () => {
    expect(() => applyPercent(100, -1)).toThrow(EArsivValidationError)
    expect(() => applyPercent(100, 101)).toThrow(EArsivValidationError)
  })
})

describe('sumMinor', () => {
  it('toplar', () => {
    expect(sumMinor([100, 200, 300])).toBe(600)
    expect(sumMinor([])).toBe(0)
  })
})
