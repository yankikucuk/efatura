import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../errors/index.js'

import { formatPortalDate, formatPortalTime, parsePortalDate } from './index.js'

describe('formatPortalDate', () => {
  it('Date nesnesini dd/MM/yyyy yapar', () => {
    expect(formatPortalDate(new Date(2026, 8, 3))).toBe('03/09/2026')
    expect(formatPortalDate(new Date(2026, 11, 31))).toBe('31/12/2026')
  })

  it('portal biçiminde gelen metni aynen döndürür', () => {
    expect(formatPortalDate('03/09/2026')).toBe('03/09/2026')
  })

  it('portalın tire ile döndürdüğü biçimi çevirir', () => {
    expect(formatPortalDate('03-09-2026')).toBe('03/09/2026')
  })

  it('ISO tarihini çevirir', () => {
    expect(formatPortalDate('2026-09-03')).toBe('03/09/2026')
  })

  it('tanımsız girdide bugünü kullanır', () => {
    expect(formatPortalDate()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('anlamsız girdide hata fırlatır', () => {
    expect(() => formatPortalDate('yarın')).toThrow(EArsivValidationError)
  })
})

describe('formatPortalTime', () => {
  it('Date nesnesini HH:mm:ss yapar', () => {
    expect(formatPortalTime(new Date(2026, 8, 3, 9, 7, 48))).toBe('09:07:48')
  })

  it('portal biçiminde gelen metni aynen döndürür', () => {
    expect(formatPortalTime('19:30:02')).toBe('19:30:02')
  })

  it('tanımsız girdide şu anı kullanır', () => {
    expect(formatPortalTime()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})

describe('parsePortalDate', () => {
  it('her iki ayırıcıyı da kabul eder', () => {
    expect(parsePortalDate('03/09/2026').getTime()).toBe(new Date(2026, 8, 3).getTime())
    expect(parsePortalDate('03-09-2026').getTime()).toBe(new Date(2026, 8, 3).getTime())
  })

  it('geçersiz takvim tarihinde hata fırlatır', () => {
    expect(() => parsePortalDate('31/02/2026')).toThrow(EArsivValidationError)
  })
})
