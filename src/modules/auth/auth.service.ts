import type { ResolvedClientOptions } from '../../config/index.js'
import { Command } from '../../constants/index.js'
import { EArsivAuthError, EArsivValidationError } from '../../core/index.js'
import {
  Endpoint,
  type HttpClient,
  parsePortalResponse,
  type TokenProvider,
} from '../../transport/index.js'

import type { Credentials, LoginCommand, TestUserCredentials } from './auth.types.js'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Oturum açma, token saklama ve kapatma. `TokenProvider` sözleşmesini uygular. */
export class AuthService implements TokenProvider {
  private currentToken: string | undefined

  constructor(
    private readonly http: HttpClient,
    private readonly options: ResolvedClientOptions,
  ) {}

  get token(): string | undefined {
    return this.currentToken
  }

  get isAuthenticated(): boolean {
    return this.currentToken !== undefined
  }

  /** Önceden alınmış bir token ile oturuma devam et. */
  setToken(token: string): void {
    // Boş veya yalnızca boşluktan oluşan bir token, `isAuthenticated`'ı
    // `true` yapar ama hiçbir isteğe yetki vermez (bkz. I7) — bu durum
    // aslında kimlik doğrulanmamış olduğu halde öyleymiş gibi görünmeye
    // neden olurdu.
    if (token.trim().length === 0) {
      throw new EArsivValidationError('Token boş veya yalnızca boşluk olamaz.', [
        { path: 'token', message: 'Geçersiz token.' },
      ])
    }
    this.currentToken = token
  }

  getToken(): string {
    if (this.currentToken === undefined) {
      throw new EArsivAuthError('Oturum açılmamış. Önce login() veya setToken() çağırın.')
    }
    return this.currentToken
  }

  /** Token'ı temizler; `TokenProvider` sözleşmesinin bir parçası (bkz. I7). */
  clearToken(): void {
    this.currentToken = undefined
  }

  /** Kullanıcı adı ve şifre ile giriş yapar, token'ı saklar ve döndürür. */
  async login(credentials: Credentials): Promise<string> {
    const command: LoginCommand =
      credentials.loginCommand ?? (this.options.environment === 'test' ? 'login' : 'anologin')

    // Giriş denemesi, yeni bir oturum kurma niyetinin beyanıdır. Başarısız
    // olursa doğru durum "kimlik doğrulanmamış"tır, "eski oturum hâlâ
    // geçerli" değil. Aksi halde çağıran, değiştirdiğini sandığı hesabın
    // altında işlem yapmaya devam ederdi — çok hesaplı kullanımda fatura
    // yanlış firma adına kesilebilirdi.
    this.currentToken = undefined

    // login yeniden denenebilir: başarısız bir giriş denemesi hiçbir kalıcı
    // durum değiştirmez (bkz. C1) — mükerrer POST, mükerrer bir belge değil,
    // yalnızca fazladan bir kimlik doğrulama denemesi anlamına gelir.
    const raw = await this.http.postForm(
      Endpoint.LOGIN,
      {
        assoscmd: command,
        rtype: 'json',
        userid: credentials.username,
        sifre: credentials.password,
        sifre2: credentials.password,
        parola: '1',
      },
      { retryable: true },
    )

    // Giriş yanıtı `data` zarfı kullanmıyor; token kökte geliyor. Yine de
    // hata biçimleri aynı olduğu için ayrıştırıcıdan geçiriyoruz.
    parsePortalResponse(raw, { command: Command.LOGIN, callId: 'login' })

    const token = isRecord(raw) ? raw.token : undefined
    if (typeof token !== 'string' || token.length === 0) {
      throw new EArsivAuthError(
        'Portal token döndürmedi. Kullanıcı adı veya şifre hatalı olabilir.',
      )
    }

    this.currentToken = token
    this.options.logger.info('e-Arşiv oturumu açıldı', { username: credentials.username })
    return token
  }

  /**
   * Test ortamının otomatik kullanıcı önerme akışı. Portal bir kullanıcı
   * kodu üretir, şifre her zaman `"1"` olur.
   */
  async loginWithTestUser(): Promise<TestUserCredentials> {
    if (this.options.environment !== 'test') {
      throw new EArsivAuthError(
        'Test kullanıcısı yalnızca test ortamında alınabilir. environment: "test" kullanın.',
      )
    }

    // login() denemeden önce token'ı temizliyor, ama buradaki esign aşaması
    // ondan ÖNCE çalışıyor. Bu adımda hata alınırsa login() hiç çağrılmaz ve
    // eski oturumun token'ı bayat kalırdı — Bulgu 1'in aynısı, bir kademe
    // yukarıda. Üretim koruması geçildikten sonra burada da temizliyoruz.
    this.currentToken = undefined

    // `kullaniciOner` retryable: true olarak işaretli çünkü test kullanıcısı
    // önerme SALT OKUNUR bir sorgu GİBİ görünüyor. Round 2 notu: bu kanıtlanmış
    // değil — paylaşılan test havuzundan gerçekten bir kullanıcı TAHSİS
    // ediyor olabilir, ki bu durumda bir yeniden deneme ikinci bir kullanıcıyı
    // "yakabilir". Yalnızca test ortamında ve zararsız olduğu için (ve retry
    // davranışını doğrulayamadığımız bir yolda değiştirmemek adına) şimdilik
    // olduğu gibi bırakıldı — bkz. final-fixes-report.md round 2 madde 7.
    const raw = await this.http.postForm(
      Endpoint.ESIGN,
      { assoscmd: 'kullaniciOner', rtype: 'json' },
      { retryable: true },
    )
    parsePortalResponse(raw, { command: Command.SUGGEST_TEST_USER, callId: 'kullaniciOner' })

    const username = isRecord(raw) ? raw.userid : undefined
    if (typeof username !== 'string' || username.length === 0) {
      throw new EArsivAuthError('e-Arşiv test kullanıcısı alınamadı. Lütfen sonra tekrar deneyin.')
    }

    const password = '1'
    const token = await this.login({ username, password })
    return { username, password, token }
  }

  /**
   * Oturumu kapatır. Token yoksa hiçbir şey yapmaz.
   *
   * Yerel token, uzak çağrı başarısız olsa bile temizlenir: istemcinin
   * kimliğinin doğrulandığına inanmaya devam etmesi, sunucuda bir oturumun
   * açık kalmasından daha tehlikelidir. Hata yine de yukarı iletilir, böylece
   * çağıran uzak oturumun kapatılamadığını bilir.
   */
  async logout(): Promise<void> {
    const token = this.currentToken
    if (token === undefined) return

    try {
      // logout bir durum DEĞİŞİKLİĞİdir; varsayılan retryable:false burada
      // bilinçli olarak KORUNUR (bkz. C1) — yeniden denenirse sunucu
      // tarafında ikinci bir oturum kapatma isteği daha atılabilir.
      await this.http.postForm(Endpoint.LOGIN, {
        assoscmd: 'logout',
        rtype: 'json',
        token,
      })
      this.options.logger.info('e-Arşiv oturumu kapatıldı')
    } finally {
      this.currentToken = undefined
    }
  }
}
