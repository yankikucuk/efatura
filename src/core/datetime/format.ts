import { EArsivValidationError } from '../errors/index.js'

import { parsePortalDate } from './parse.js'

/** Kütüphanenin her yerde kabul ettiği tarih girdisi. */
export type DateInput = Date | string

const PORTAL_DATE = /^\d{2}\/\d{2}\/\d{4}$/
const PORTAL_TIME = /^\d{2}:\d{2}:\d{2}$/

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
  if (typeof input === 'string' && PORTAL_DATE.test(input)) return input
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
