/**
 * Günlük seviyeleri.
 *
 * Kütüphane yalnızca `debug` (yeniden deneme) ve `info` (oturum açma/kapama)
 * seviyelerinde yazar; `warn` ve `error` sözleşmenin parçasıdır ama şu anda
 * kütüphane tarafından kullanılmaz — başarısızlıklar günlüğe yazılmaz,
 * FIRLATILIR.
 *
 * @example
 * ```ts
 * import type { LogLevel } from '@yankikucuk/efatura'
 *
 * const level: LogLevel = 'debug'
 * console.log(level)
 * ```
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Yapısal ek bağlam; hassas veri (token, şifre) buraya konmaz.
 *
 * Kütüphanenin gönderdiği anahtarlar: `username` (oturum açma), `url`,
 * `attempt`, `cause` (yeniden deneme), `command`. `url` içindeki `token`
 * sorgu parametresi gizlenmiş hâldedir.
 *
 * @example
 * ```ts
 * import type { LogContext } from '@yankikucuk/efatura'
 *
 * const context: LogContext = { command: 'EARSIV_PORTAL_TASLAKLARI_GETIR', attempt: 2 }
 * console.log(context.attempt)
 * ```
 */
export type LogContext = Record<string, unknown>

/**
 * Kütüphanenin dışarıya bağımlı olmayan minimal günlükleme sözleşmesi.
 *
 * Dört seviye için de bir işlev sağlamanız yeterlidir; `pino`, `winston` gibi
 * kütüphaneler bu şekle doğrudan uyar ya da ince bir sarmalayıcıyla uydurulur.
 *
 * @example Konsola yazan basit bir uygulama
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { Logger } from '@yankikucuk/efatura'
 *
 * const logger: Logger = {
 *   debug: (message, context) => { console.debug(message, context) },
 *   info: (message, context) => { console.info(message, context) },
 *   warn: (message, context) => { console.warn(message, context) },
 *   error: (message, context) => { console.error(message, context) },
 * }
 * const client = new EArsivClient({ environment: 'test', logger })
 * await client.loginWithTestUser() // "e-Arşiv oturumu açıldı" info olarak yazılır
 * ```
 */
export type Logger = Record<LogLevel, (message: string, context?: LogContext) => void>
