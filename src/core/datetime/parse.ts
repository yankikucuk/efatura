import { EArsivValidationError } from '../errors/index.js'

/** Portalın kabul ettiği ve döndürdüğü gün-ay-yıl biçimleri. */
const DAY_FIRST = /^(\d{2})[/-](\d{2})[/-](\d{4})$/
/** ISO 8601 tarih kısmı. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/

function build(year: number, month: number, day: number, source: string): Date {
  const date = new Date(year, month - 1, day)
  // JavaScript taşan tarihleri sessizce kaydırır (31 Şubat -> 3 Mart);
  // geri okuyarak gerçekten var olan bir gün olduğunu doğruluyoruz.
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  if (!valid) {
    throw new EArsivValidationError(`Geçersiz takvim tarihi: ${source}`, [
      { path: 'date', message: `Takvimde bulunmayan tarih: ${source}` },
    ])
  }
  return date
}

/**
 * `dd/MM/yyyy`, `dd-MM-yyyy` veya `yyyy-MM-dd` biçimindeki metni Date'e çevirir.
 *
 * Dönen `Date` YEREL saat diliminde, gün başında (00:00:00) kurulur; saat
 * bilgisi taşımaz.
 *
 * @param value Ayrıştırılacak metin. Üç biçimden biri olmalıdır; ISO
 *   girdisinde tarihten sonrası (`T10:00:00Z` gibi) YOK SAYILIR.
 * @returns Ayrıştırılmış `Date`.
 * @throws {EArsivValidationError} Biçim tanınmazsa ya da tarih takvimde
 *   yoksa (`31/02/2026`) — JavaScript'in sessizce kaydırdığı bu durum burada
 *   yakalanır.
 *
 * @example
 * ```ts
 * import { parsePortalDate } from 'efatura'
 *
 * const date = parsePortalDate('03-09-2026')
 * console.log(date.getFullYear(), date.getMonth() + 1, date.getDate()) // 2026 9 3
 * ```
 */
export function parsePortalDate(value: string): Date {
  const dayFirst = DAY_FIRST.exec(value)
  if (dayFirst) {
    return build(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]), value)
  }
  const iso = ISO_DATE.exec(value)
  if (iso) {
    return build(Number(iso[1]), Number(iso[2]), Number(iso[3]), value)
  }
  throw new EArsivValidationError(`Tarih biçimi tanınmadı: ${value}`, [
    { path: 'date', message: 'Beklenen biçimler: dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd' },
  ])
}
