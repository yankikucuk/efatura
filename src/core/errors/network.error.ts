import { EArsivError } from './base.error.js'

/**
 * `EArsivNetworkError`'un taşıdığı bağlam.
 *
 * @example
 * ```ts
 * import { EArsivNetworkError } from 'efatura'
 * import type { NetworkErrorContext } from 'efatura'
 *
 * const context: NetworkErrorContext = {
 *   url: 'https://earsivportaltest.efatura.gov.tr/earsiv-services/dispatch',
 *   status: 503,
 *   attempts: 3,
 *   cause: new Error('ECONNRESET'),
 * }
 * const error = new EArsivNetworkError('Portala ulaşılamadı.', context)
 * console.log(error.attempts, error.cause)
 * ```
 */
export interface NetworkErrorContext {
  /** İstek adresi. `token` sorgu parametresi `***` ile gizlenmiş hâldedir. */
  url: string
  /** Yanıt alındıysa HTTP durum kodu. */
  status?: number
  /** Vazgeçmeden önce yapılan toplam deneme sayısı. */
  attempts: number
  /** Kök neden (ör. `AbortError`, `TypeError`); verilirse `cause` olarak korunur. */
  cause?: unknown
}

/**
 * Zaman aşımı, DNS, bağlantı kesintisi veya HTTP 5xx.
 *
 * Portalın JSON olarak ayrıştırılamayan bir yanıt döndürmesi ve indirilen
 * belge paketinin boş gelmesi de bu sınıfla bildirilir — ikisi de "yanıt
 * geldi ama kullanılabilir değil" durumudur.
 *
 * Yeniden deneme davranışı komuta göre değişir: yalnızca SALT OKUNUR komutlar
 * `retry.attempts` kadar denenir; mutasyon komutları (fatura oluşturma,
 * imzalama, silme...) her koşulda TEK KEZ denenir — bir mutasyonu yeniden
 * göndermek mükerrer bir hukuki belge üretebilirdi. Bu yüzden `attempts`
 * alanı bir mutasyonda her zaman `1`'dir.
 *
 * @example
 * ```ts
 * import { EArsivClient, EArsivNetworkError } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test', timeoutMs: 5_000 })
 *
 * try {
 *   await client.loginWithTestUser()
 * } catch (error) {
 *   if (error instanceof EArsivNetworkError) {
 *     // url içindeki token gizlenmiştir; günlüğe yazmak güvenlidir.
 *     console.error(error.url, error.status, error.attempts, error.cause)
 *   }
 * }
 * ```
 */
export class EArsivNetworkError extends EArsivError {
  /** Her zaman `'network'`. */
  readonly kind = 'network'
  /** İstek adresi; `token` parametresi `***` ile gizlenmiştir. */
  readonly url: string
  /** HTTP durum kodu; hiç yanıt alınamadıysa `undefined`. */
  readonly status: number | undefined
  /** GERÇEKTEN yapılan deneme sayısı — yapılandırılmış tavan değil. */
  readonly attempts: number

  /**
   * @param message Hata metni.
   * @param context Adres, varsa durum kodu, gerçek deneme sayısı ve kök
   *   neden. `cause` verilmemişse `Error.cause` hiç kurulmaz.
   */
  constructor(message: string, context: NetworkErrorContext) {
    super(message, context.cause === undefined ? undefined : { cause: context.cause })
    this.url = context.url
    this.status = context.status
    this.attempts = context.attempts
  }
}
