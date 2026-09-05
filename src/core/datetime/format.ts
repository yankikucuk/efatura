import { EArsivValidationError } from '../errors/index.js'

import { parsePortalDate } from './parse.js'

/** Kütüphanenin her yerde kabul ettiği tarih girdisi. */
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

/** Portalın fatura yükünde beklediği `dd/MM/yyyy` biçimi. */
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

/** Portalın fatura yükünde beklediği `HH:mm:ss` biçimi. */
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
