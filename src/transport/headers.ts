import { Endpoint } from './endpoints.js'

/**
 * Portal `Referer` başlığını doğruluyor; eksik olduğunda istek reddedilir.
 * Başlık adları küçük harf — Node fetch bunları zaten normalize eder, ancak
 * testlerde birebir karşılaştırma yapabilmek için burada da küçük tutuyoruz.
 */
export function buildPortalHeaders(baseUrl: string, userAgent: string): Record<string, string> {
  return {
    accept: '*/*',
    'accept-language': 'tr,en-US;q=0.9,en;q=0.8',
    'cache-control': 'no-cache',
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    pragma: 'no-cache',
    referer: `${baseUrl}${Endpoint.REFERRER}`,
    'user-agent': userAgent,
  }
}
