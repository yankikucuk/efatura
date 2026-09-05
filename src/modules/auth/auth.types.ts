/**
 * Portalın `assos-login` endpoint'ine gönderilen komut.
 *
 * `'login'` test ortamının, `'anologin'` canlı ortamın komutudur; doğru değer
 * ortamdan otomatik seçilir.
 *
 * @example
 * ```ts
 * import type { LoginCommand } from 'efatura'
 *
 * const command: LoginCommand = 'anologin'
 * console.log(command)
 * ```
 */
export type LoginCommand = 'login' | 'anologin'

/**
 * `login()` girdisi.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { Credentials } from 'efatura'
 *
 * const credentials: Credentials = {
 *   username: process.env.EARSIV_USER ?? '',
 *   password: process.env.EARSIV_PASSWORD ?? '',
 * }
 * const client = new EArsivClient({ environment: 'production' })
 * await client.login(credentials)
 * ```
 */
export interface Credentials {
  /** Portalın kullanıcı kodu — genellikle VKN veya TCKN. Portal `userid` alanı. */
  username: string
  /** Portal şifresi. Portal `sifre` ve `sifre2` alanlarının ikisine de gönderilir. */
  password: string
  /**
   * Varsayılan ortama göre seçilir: test → `login`, canlı → `anologin`.
   * Portal davranışı değişirse bu alanla geçersiz kılınabilir.
   */
  loginCommand?: LoginCommand
}

/**
 * `loginWithTestUser()` sonucu — portalın tahsis ettiği test kullanıcısı.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { TestUserCredentials } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * const user: TestUserCredentials = await client.loginWithTestUser()
 * // Aynı kullanıcıyla sonra tekrar giriş yapmak için saklanabilir.
 * console.log(user.username, user.password)
 * ```
 */
export interface TestUserCredentials {
  /** Portalın ürettiği kullanıcı kodu; her çağrıda YENİ bir kullanıcı tahsis edilir. */
  username: string
  /** Test kullanıcılarının şifresi her zaman `"1"`'dir. */
  password: string
  /** Bu kullanıcıyla açılmış oturumun token'ı; istemcide zaten saklanmıştır. */
  token: string
}
