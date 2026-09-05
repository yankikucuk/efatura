import { EArsivValidationError } from '../errors/index.js'

import { parsePortalDate } from './parse.js'

/**
 * Kütüphanenin her yerde kabul ettiği tarih girdisi.
 *
 * `Date` nesnesi ya da şu üç biçimden birinde metin: `dd/MM/yyyy` (portalın
 * kendi biçimi), `dd-MM-yyyy` (portalın liste yanıtlarında döndürdüğü biçim)
 * ve `yyyy-MM-dd` (ISO). Başka bir metin `EArsivValidationError` ile
 * reddedilir; takvimde olmayan bir gün (ör. `31/02/2026`) biçim doğru olsa
 * bile reddedilir.
 *
 * @example
 * ```ts
 * import { formatPortalDate } from '@yankikucuk/efatura'
 * import type { DateInput } from '@yankikucuk/efatura'
 *
 * const inputs: DateInput[] = [new Date(2026, 8, 3), '03/09/2026', '03-09-2026', '2026-09-03']
 * console.log(inputs.map((input) => formatPortalDate(input)))
 * // hepsi '03/09/2026'
 * ```
 */
export type DateInput = Date | string

const PORTAL_DATE = /^\d{2}\/\d{2}\/\d{4}$/
// Saat deseni aralık da doğrular: yalnızca şekle bakmak "99:99:99" gibi
// geçersiz saatlerin sessizce portala gitmesine izin verirdi.
const PORTAL_TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/

const pad = (value: number): string => String(value).padStart(2, '0')

function toDate(input: DateInput | undefined, label: string): Date {
  if (input === undefined) return new Date()
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new EArsivValidationError(`${label} geçersiz bir Date nesnesi.`, [
        { path: label, message: 'Invalid Date' },
      ])
    }
    return input
  }
  return parsePortalDate(input)
}

/**
 * Portalın fatura yükünde beklediği `dd/MM/yyyy` biçimi.
 *
 * @param input `Date` nesnesi ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd`
 *   biçiminde metin. VERİLMEZSE bugünün tarihi kullanılır.
 * @returns `dd/MM/yyyy` biçiminde metin.
 * @throws {EArsivValidationError} Metin bu üç biçimden birine uymuyorsa,
 *   takvimde olmayan bir günü gösteriyorsa (`31/02/2026`) veya `Date`
 *   geçersizse (`Invalid Date`).
 *
 * @example
 * ```ts
 * import { formatPortalDate } from '@yankikucuk/efatura'
 *
 * console.log(formatPortalDate(new Date(2026, 8, 3))) // '03/09/2026'
 * console.log(formatPortalDate('2026-09-03')) // '03/09/2026'
 * console.log(formatPortalDate()) // bugün, dd/MM/yyyy
 * ```
 */
export function formatPortalDate(input?: DateInput): string {
  if (typeof input === 'string' && PORTAL_DATE.test(input)) {
    // Şekil doğru olsa bile takvimde var olmayan bir gün olabilir
    // (31/02/2026). Doğrulamayı atlamamak için parse edip aynen geri veriyoruz.
    parsePortalDate(input)
    return input
  }
  const date = toDate(input, 'date')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear())}`
}

/**
 * Portalın fatura yükünde beklediği `HH:mm:ss` biçimi.
 *
 * @param input `Date` nesnesi (saat/dakika/saniyesi alınır) ya da doğrudan
 *   `HH:mm:ss` biçiminde metin. VERİLMEZSE şu anki saat kullanılır. Metin
 *   girdisinde YALNIZCA `HH:mm:ss` kabul edilir — tarih biçimlerinin aksine
 *   burada başka bir gösterim yoktur.
 * @returns `HH:mm:ss` biçiminde metin.
 * @throws {EArsivValidationError} Metin `HH:mm:ss` biçiminde değilse veya
 *   aralık dışıysa (`24:00:00`, `99:99:99`), ya da `Date` geçersizse.
 *
 * @example
 * ```ts
 * import { formatPortalTime } from '@yankikucuk/efatura'
 *
 * console.log(formatPortalTime(new Date(2026, 8, 3, 9, 7, 48))) // '09:07:48'
 * console.log(formatPortalTime('19:30:02')) // '19:30:02'
 * ```
 */
export function formatPortalTime(input?: DateInput): string {
  if (typeof input === 'string') {
    if (PORTAL_TIME.test(input)) return input
    throw new EArsivValidationError(`Saat biçimi tanınmadı: ${input}`, [
      { path: 'time', message: 'Beklenen biçim: HH:mm:ss' },
    ])
  }
  const date = input ?? new Date()
  if (Number.isNaN(date.getTime())) {
    throw new EArsivValidationError('time geçersiz bir Date nesnesi.', [
      { path: 'time', message: 'Invalid Date' },
    ])
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
