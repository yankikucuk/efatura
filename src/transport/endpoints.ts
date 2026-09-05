/**
 * Portalın HTTP uç noktaları. Yollar taban adrese (bkz. `BASE_URLS`) eklenir.
 *
 * `HttpClient` bu değerleri `EndpointPath` olarak alır; başka bir yol
 * gönderilemez.
 *
 * @example
 * ```ts
 * import { BASE_URLS, Endpoint } from '@yankikucuk/efatura'
 *
 * console.log(`${BASE_URLS.test}${Endpoint.DISPATCH}`)
 * // https://earsivportaltest.efatura.gov.tr/earsiv-services/dispatch
 * ```
 */
export const Endpoint = {
  /** Test kullanıcısı önerme. */
  ESIGN: '/earsiv-services/esign',
  /** Oturum açma ve kapatma. */
  LOGIN: '/earsiv-services/assos-login',
  /** Komut tabanlı tüm diğer işlemler. */
  DISPATCH: '/earsiv-services/dispatch',
  /** Belge paketi (ZIP) indirme. */
  DOWNLOAD: '/earsiv-services/download',
  /** Portalın kendi giriş sayfası; Referer başlığı olarak zorunlu. */
  REFERRER: '/intragiris.html',
} as const

/**
 * {@link Endpoint} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { Endpoint } from '@yankikucuk/efatura'
 * import type { EndpointPath } from '@yankikucuk/efatura'
 *
 * const path: EndpointPath = Endpoint.DOWNLOAD
 * console.log(path)
 * ```
 */
export type EndpointPath = (typeof Endpoint)[keyof typeof Endpoint]
