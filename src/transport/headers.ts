import { Endpoint } from './endpoints.js'

/**
 * Portalın kabul ettiği istek başlıklarını üretir.
 *
 * Portal `Referer` başlığını doğruluyor; eksik olduğunda istek reddedilir.
 * Başlık adları küçük harf — Node fetch bunları zaten normalize eder, ancak
 * testlerde birebir karşılaştırma yapabilmek için burada da küçük tutuyoruz.
 *
 * `HttpClient` bunu kurulumda bir kez çağırır; doğrudan çağırmanız yalnızca
 * kendi taşıma katmanınızı yazacaksanız gerekir.
 *
 * @param baseUrl Portalın taban adresi (bkz. `BASE_URLS`). `Referer` başlığı
 *   bunun üzerine portalın giriş sayfası eklenerek kurulur.
 * @param userAgent Gönderilecek `User-Agent` dizesi; boş bırakmayın — portal
 *   otomasyon kokan veya boş `User-Agent` ile gelen istekleri reddedebiliyor.
 * @returns Küçük harfli anahtarlarla, doğrudan `fetch`'e verilebilecek başlık
 *   nesnesi. Her çağrıda YENİ bir nesne döner.
 *
 * @example
 * ```ts
 * import { BASE_URLS, buildPortalHeaders, DEFAULT_USER_AGENT } from '@yankikucuk/efatura'
 *
 * const headers = buildPortalHeaders(BASE_URLS.test, DEFAULT_USER_AGENT)
 * console.log(headers.referer)
 * // https://earsivportaltest.efatura.gov.tr/intragiris.html
 * console.log(headers['content-type'])
 * // application/x-www-form-urlencoded;charset=UTF-8
 * ```
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
