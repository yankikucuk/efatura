/**
 * ISO 4217 para birimi kodları. Portal bu kodları `paraBirimi` alanında bekler.
 *
 * Liste, portalın fatura ve serbest meslek makbuzu ekranlarında sunduğu
 * kodlardır. TRY dışında bir kod seçildiğinde `currencyRate` (portal `kur` /
 * `dovzTLkur` alanı) ZORUNLUDUR ve pozitif olmalıdır; verilmezse istek ağa
 * çıkmadan `EArsivValidationError` ile reddedilir.
 *
 * @example
 * ```ts
 * import { Currency, Unit } from '@yankikucuk/efatura'
 * import type { InvoiceInput } from '@yankikucuk/efatura'
 *
 * const input: InvoiceInput = {
 *   currency: Currency.EURO,
 *   currencyRate: 37.42,
 *   buyer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK GMBH' },
 *   lineItems: [{ name: 'Lisans', quantity: 1, unit: Unit.PIECE, unitPrice: 1_000, vatRate: 0 }],
 * }
 * console.log(input.currency)
 * ```
 */
export const Currency = {
  /** `TRY` — Türk lirası; kütüphanenin her yerdeki varsayılanı. */
  TURKISH_LIRA: 'TRY',
  /** `USD` — ABD doları. */
  US_DOLLAR: 'USD',
  /** `EUR` — Euro. */
  EURO: 'EUR',
  /** `GBP` — İngiliz sterlini. */
  BRITISH_POUND: 'GBP',
  /** `CHF` — İsviçre frangı. */
  SWISS_FRANC: 'CHF',
  /** `JPY` — Japon yeni. */
  JAPANESE_YEN: 'JPY',
  /** `RUB` — Rus rublesi. */
  RUSSIAN_RUBLE: 'RUB',
  /** `CNY` — Çin yuanı. */
  CHINESE_YUAN: 'CNY',
  /** `SAR` — Suudi riyali. */
  SAUDI_RIYAL: 'SAR',
  /** `AZN` — Azerbaycan manatı. */
  AZERBAIJANI_MANAT: 'AZN',
} as const

/**
 * {@link Currency} sabitlerinden türetilen birleşim tipi.
 *
 * Listede olmayan bir ISO 4217 kodu bu tiple KABUL EDİLMEZ; portalın kendi
 * açılır listesinde bulunmayan kodların davranışı doğrulanmadığı için tip
 * bilinçli olarak dar tutulmuştur.
 *
 * @example
 * ```ts
 * import { Currency } from '@yankikucuk/efatura'
 * import type { CurrencyCode } from '@yankikucuk/efatura'
 *
 * const code: CurrencyCode = Currency.US_DOLLAR
 * console.log(code)
 * ```
 */
export type CurrencyCode = (typeof Currency)[keyof typeof Currency]
