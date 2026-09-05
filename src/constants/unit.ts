/**
 * UN/ECE Recommendation 20 birim kodları — portal `birim` alanı.
 *
 * Fatura ve müstahsil makbuzu kalemlerinde ZORUNLUDUR. Kodlar portalın kendi
 * açılır listesinden alınmıştır; listede olmayan bir kodun davranışı
 * doğrulanmadığı için tip dar tutulmuştur.
 *
 * @example
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { LineItemInput } from '@yankikucuk/efatura'
 *
 * const saatlik: LineItemInput = {
 *   name: 'Danışmanlık',
 *   quantity: 8,
 *   unit: Unit.HOUR,
 *   unitPrice: 750,
 *   vatRate: 20,
 * }
 * const kiloluk: LineItemInput = {
 *   name: 'Zeytin',
 *   quantity: 250,
 *   unit: Unit.KILOGRAM,
 *   unitPrice: 40,
 *   vatRate: 1,
 * }
 * console.log(saatlik.unit, kiloluk.unit)
 * ```
 */
export const Unit = {
  /** `DAY` — gün. */
  DAY: 'DAY',
  /** `MON` — ay. */
  MONTH: 'MON',
  /** `ANN` — yıl. */
  YEAR: 'ANN',
  /** `HUR` — saat. */
  HOUR: 'HUR',
  /** `D61` — dakika. */
  MINUTE: 'D61',
  /** `D62` — saniye. */
  SECOND: 'D62',
  /** `C62` — adet. Kütüphanenin okuma yolundaki yedek değeri de budur. */
  PIECE: 'C62',
  /** `PA` — paket. */
  PACKAGE: 'PA',
  /** `BX` — kutu. */
  BOX: 'BX',
  /** `MGM` — miligram. */
  MILLIGRAM: 'MGM',
  /** `GRM` — gram. */
  GRAM: 'GRM',
  /** `KGM` — kilogram. */
  KILOGRAM: 'KGM',
  /** `LTR` — litre. */
  LITRE: 'LTR',
  /** `TNE` — ton. */
  TONNE: 'TNE',
  /** `MMT` — milimetre. */
  MILLIMETRE: 'MMT',
  /** `CMT` — santimetre. */
  CENTIMETRE: 'CMT',
  /** `MTR` — metre. */
  METRE: 'MTR',
  /** `KTM` — kilometre. */
  KILOMETRE: 'KTM',
  /** `MLT` — mililitre. */
  MILLILITRE: 'MLT',
  /** `CMK` — santimetrekare. */
  SQUARE_CENTIMETRE: 'CMK',
  /** `CMQ` — santimetreküp. */
  CUBIC_CENTIMETRE: 'CMQ',
  /** `MTK` — metrekare. */
  SQUARE_METRE: 'MTK',
  /** `MTQ` — metreküp. */
  CUBIC_METRE: 'MTQ',
  /** `KWH` — kilovatsaat. */
  KILOWATT_HOUR: 'KWH',
  /** `CT` — karat. */
  CARAT: 'CT',
  /** `PR` — çift. */
  PAIR: 'PR',
  /** `SET` — set/takım. */
  SET: 'SET',
  /** `DZN` — düzine. */
  DOZEN: 'DZN',
  /** `T3` — bin adet. */
  THOUSAND_PIECES: 'T3',
} as const

/**
 * {@link Unit} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { UnitCode } from '@yankikucuk/efatura'
 *
 * const unit: UnitCode = Unit.KILOGRAM
 * console.log(unit)
 * ```
 */
export type UnitCode = (typeof Unit)[keyof typeof Unit]
