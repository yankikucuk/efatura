import { EArsivError } from './base.error.js'

/**
 * Token yok, süresi dolmuş veya giriş reddedildi.
 *
 * Üç durumda fırlar: (1) hiç oturum açılmadan yetki gerektiren bir çağrı
 * yapıldı, (2) portal açıkça oturum zaman aşımı bildirdi ya da yetki-şekilli
 * bir hata `getUserMenu` probuyla süre dolumu olarak DOĞRULANDI — bu durumda
 * yerel token temizlenmiştir, (3) giriş bilgileri reddedildi.
 *
 * Doğru tepki her zaman aynıdır: yeniden `login()` (veya `setToken()`).
 *
 * @example Otomatik yeniden giriş
 * ```ts
 * import { EArsivAuthError, EArsivClient } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * client.setToken('bayat-token')
 *
 * try {
 *   await client.getUserInfo()
 * } catch (error) {
 *   if (!(error instanceof EArsivAuthError)) throw error
 *   // Token temizlenmiş durumda; oturumu yeniden kur ve tekrar dene.
 *   await client.loginWithTestUser()
 *   console.log(await client.getUserInfo())
 * }
 * ```
 */
export class EArsivAuthError extends EArsivError {
  /** Her zaman `'auth'`. */
  readonly kind = 'auth'
}
