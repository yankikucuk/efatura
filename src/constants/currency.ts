/** ISO 4217 para birimi kodları. Portal bu kodları `paraBirimi` alanında bekler. */
export const Currency = {
  TURKISH_LIRA: 'TRY',
  US_DOLLAR: 'USD',
  EURO: 'EUR',
  BRITISH_POUND: 'GBP',
  SWISS_FRANC: 'CHF',
  JAPANESE_YEN: 'JPY',
  RUSSIAN_RUBLE: 'RUB',
  CHINESE_YUAN: 'CNY',
  SAUDI_RIYAL: 'SAR',
  AZERBAIJANI_MANAT: 'AZN',
} as const

export type CurrencyCode = (typeof Currency)[keyof typeof Currency]
