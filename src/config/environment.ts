/**
 * Portalın iki ortamı.
 *
 * `TEST` ortamı gerçek hukuki belge üretmez ve `loginWithTestUser()` ile
 * kullanıcı tahsis edilebilir; `PRODUCTION` gerçek mükellef hesabıdır ve
 * orada oluşturulan her belge gerçek bir hukuki belgedir.
 *
 * @example
 * ```ts
 * import { EArsivClient, Environment } from 'efatura'
 *
 * const client = new EArsivClient({ environment: Environment.TEST })
 * console.log(client.environment)
 * ```
 */
export const Environment = {
  /** `'production'` — canlı portal; oluşturulan belgeler GERÇEKTİR. Varsayılan. */
  PRODUCTION: 'production',
  /** `'test'` — test portalı; `loginWithTestUser()` yalnızca burada çalışır. */
  TEST: 'test',
} as const

/**
 * {@link Environment} sabitlerinden türetilen birleşim tipi.
 *
 * `ClientOptions.environment` ve `EArsivClient.environment` bu tipi kullanır;
 * başka bir değer verilirse `resolveClientOptions` `EArsivValidationError`
 * fırlatır.
 *
 * @example
 * ```ts
 * import { Environment } from 'efatura'
 * import type { EnvironmentName } from 'efatura'
 *
 * const name: EnvironmentName = Environment.PRODUCTION
 * console.log(name)
 * ```
 */
export type EnvironmentName = (typeof Environment)[keyof typeof Environment]

/**
 * Portalın canlı ve test ortamlarının taban adresleri.
 *
 * Her istek bu adrese göre kurulur; `getDownloadUrl` de bu tabanı kullanır.
 * Adres seçimi `ClientOptions.environment` ile yapılır — taban adres elle
 * geçersiz kılınamaz.
 *
 * @example
 * ```ts
 * import { BASE_URLS } from 'efatura'
 *
 * console.log(BASE_URLS.test) // https://earsivportaltest.efatura.gov.tr
 * console.log(BASE_URLS.production) // https://earsivportal.efatura.gov.tr
 * ```
 */
export const BASE_URLS: Record<EnvironmentName, string> = {
  production: 'https://earsivportal.efatura.gov.tr',
  test: 'https://earsivportaltest.efatura.gov.tr',
}
