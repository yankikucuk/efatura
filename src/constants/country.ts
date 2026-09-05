/**
 * Portal `ulke` alanında ülkenin Türkçe adını bekler, kod değil.
 * Tam GİB listesi uzundur; en sık kullanılanlar sabitlenmiştir. Listede
 * olmayan bir ülke için `CountryName` yerine düz string kullanılabilir.
 */
export const Country = {
  TURKIYE: 'Türkiye',
  ALMANYA: 'Almanya',
  AMERIKA_BIRLESIK_DEVLETLERI: 'Amerika Birleşik Devletleri',
  BIRLESIK_KRALLIK: 'Birleşik Krallık',
  FRANSA: 'Fransa',
  HOLLANDA: 'Hollanda',
  ITALYA: 'İtalya',
  RUSYA_FEDERASYONU: 'Rusya Federasyonu',
  CIN: 'Çin',
  AZERBAYCAN: 'Azerbaycan',
} as const

export type CountryName = (typeof Country)[keyof typeof Country] | (string & {})
