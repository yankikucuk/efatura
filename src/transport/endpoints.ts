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

export type EndpointPath = (typeof Endpoint)[keyof typeof Endpoint]
