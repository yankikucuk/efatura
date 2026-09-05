/**
 * Portalın tarih ve saat biçimleri.
 *
 * Portal yükte `dd/MM/yyyy` bekler ama KENDİ yanıtlarında `dd-MM-yyyy`
 * döndürür (aynı belge, iki ayrı biçim); ISO tarih hiç kabul edilmez. Süit her
 * üç girdi biçiminin tek bir çıktı biçimine indirgendiğini sabitler.
 *
 * Asıl güvence TAKVİM doğrulamasıdır: `31/02/2026` biçim olarak GEÇERLİDİR ve
 * yalnızca şekle bakan bir ayrıştırıcı bunu portala gönderirdi. Portal böyle
 * bir tarihi "Form parametrelerinde sorun var" gibi teşhis edilemeyen bir
 * metinle reddediyor; hata yerelde ve alan adıyla verilmeli. `24:00:00` ve
 * `99:99:99` saat tarafındaki aynı vakadır.
 */

import { describe, expect, it } from 'vitest'

import { EArsivValidationError } from '../errors/index.js'

import { formatPortalDate, formatPortalTime, parsePortalDate } from './index.js'

describe('formatPortalDate', () => {
  // Kapsam: yazma yönü — Date, portal biçimi, tire ayırıcılı biçim ve ISO
  // girdilerinin tek çıktıya indirgenmesi + takvimde olmayan günün reddi.
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

  it('portal biçiminde olsa bile takvimde olmayan günü reddeder', () => {
    expect(() => formatPortalDate('31/02/2026')).toThrow(EArsivValidationError)
    expect(() => formatPortalDate('99/99/2026')).toThrow(EArsivValidationError)
  })
})

describe('formatPortalTime', () => {
  // Kapsam: saat tarafındaki aynı sözleşme. `24:00:00` şekil olarak geçerli
  // ama saat olarak yoktur; reddedilmesi bilinçlidir.
  it('Date nesnesini HH:mm:ss yapar', () => {
    expect(formatPortalTime(new Date(2026, 8, 3, 9, 7, 48))).toBe('09:07:48')
  })

  it('portal biçiminde gelen metni aynen döndürür', () => {
    expect(formatPortalTime('19:30:02')).toBe('19:30:02')
  })

  it('tanımsız girdide şu anı kullanır', () => {
    expect(formatPortalTime()).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('şekli doğru ama aralık dışı saati reddeder', () => {
    expect(() => formatPortalTime('99:99:99')).toThrow(EArsivValidationError)
    expect(() => formatPortalTime('24:00:00')).toThrow(EArsivValidationError)
  })
})

describe('parsePortalDate', () => {
  // Kapsam: okuma yönü — portalın kendi döndürdüğü İKİ ayırıcının da Date'e
  // çevrilmesi.
  it('her iki ayırıcıyı da kabul eder', () => {
    expect(parsePortalDate('03/09/2026').getTime()).toBe(new Date(2026, 8, 3).getTime())
    expect(parsePortalDate('03-09-2026').getTime()).toBe(new Date(2026, 8, 3).getTime())
  })

  it('geçersiz takvim tarihinde hata fırlatır', () => {
    expect(() => parsePortalDate('31/02/2026')).toThrow(EArsivValidationError)
  })
})
