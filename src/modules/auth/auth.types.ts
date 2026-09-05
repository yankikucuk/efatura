/** Portalın `assos-login` endpoint'ine gönderilen komut. */
export type LoginCommand = 'login' | 'anologin'

export interface Credentials {
  username: string
  password: string
  /**
   * Varsayılan ortama göre seçilir: test → `login`, canlı → `anologin`.
   * Portal davranışı değişirse bu alanla geçersiz kılınabilir.
   */
  loginCommand?: LoginCommand
}

export interface TestUserCredentials {
  username: string
  password: string
  token: string
}
