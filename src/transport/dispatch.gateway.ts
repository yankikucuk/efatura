import { randomUUID } from 'node:crypto'

import {
  Command,
  type CommandName,
  PageName,
  type PageNameValue,
  RETRYABLE_COMMANDS,
} from '../constants/index.js'
import { EArsivApiError, EArsivAuthError } from '../core/index.js'

import { Endpoint } from './endpoints.js'
import type { HttpClient } from './http-client.js'
import { parsePortalResponse } from './response.parser.js'

/**
 * Oturum token'ını sağlayan sözleşme. `transport` katmanı `modules/auth`
 * içine bakamayacağı için bağımlılık tersine çevrilir: `AuthService` bunu
 * uygular.
 *
 * Kendi token yönetiminizi (ör. paylaşımlı bir önbellek) takmak isterseniz
 * bu iki metodu sağlamanız yeterlidir.
 *
 * @example Sabit token taşıyan bir uygulama
 * ```ts
 * import { EArsivAuthError } from '@yankikucuk/efatura'
 * import type { TokenProvider } from '@yankikucuk/efatura'
 *
 * let token: string | undefined = 'kayitli-token'
 * const provider: TokenProvider = {
 *   getToken: () => {
 *     if (token === undefined) throw new EArsivAuthError('Oturum açılmamış.')
 *     return token
 *   },
 *   clearToken: () => {
 *     token = undefined
 *   },
 * }
 * console.log(provider.getToken())
 * ```
 */
export interface TokenProvider {
  /** Geçerli token; yoksa `EArsivAuthError` fırlatır. */
  getToken(): string
  /**
   * Token'ı temizler. Portal sunucu tarafında süresi dolmuş bir token için
   * "Bu işlem için yetkiniz yok" döndürdüğünde çağrılır (bkz. I7) — aksi
   * halde `isAuthenticated` sonsuza kadar `true` kalır ve uzun süre çalışan
   * bir süreç kendini asla toparlayamaz.
   */
  clearToken(): void
}

/**
 * Portalın sunucu tarafı token süresi dolumunu bildirdiği metin.
 *
 * DİKKAT (round 2 madde 1): bu metin AYNI ZAMANDA en az bir gerçek yetki
 * kısıtlamasında da kullanılıyor — spec §2.5, test ortamında
 * `EARSIV_PORTAL_TELEFONNO_SORGULA`'nın bu metinle reddedildiğini ama bunun
 * bayat bir token DEĞİL, kalıcı bir izin kısıtlaması olduğunu belgeliyor.
 * Metin kendisi iki durumu AYIRT ETMEZ; bu yüzden `call()` metni gördüğünde
 * doğrudan temizlemez, bir `probeTokenIsExpired()` çağrısıyla DOĞRULAR.
 */
const AUTH_EXPIRED_PATTERN = /yetkiniz yok/i

/**
 * Portalın oturumun AÇIKÇA süresi dolduğunu bildirdiği metin (round 3
 * madde 2, furkankadioglu#6). `AUTH_EXPIRED_PATTERN`'ın aksine bu metin İKİ
 * ANLAMA GELMEZ — yalnızca süre dolumunu ifade eder, kalıcı bir yetki
 * kısıtlaması olma ihtimali yok. Bu yüzden `probeTokenIsExpired()` ile
 * doğrulamaya gerek yoktur: token doğrudan temizlenir, hiçbir prob isteği
 * atılmaz.
 */
const SESSION_TIMEOUT_PATTERN = /zaman aşımına uğradı/i

/**
 * `/dispatch` endpoint'ine komut gönderen ince katman.
 *
 * Üç işi vardır: isteğe `cmd`/`callid`/`pageName`/`token`/`jp` alanlarını
 * kurmak, yanıt zarfını `parsePortalResponse` ile çözmek ve OTURUM SÜRESİ
 * DOLUMUNU tespit edip token'ı temizlemek. Yeniden deneme kararı komuta göre
 * `RETRYABLE_COMMANDS`'tan okunur — çağıran bunu ayarlayamaz.
 *
 * @example Servisleri kendiniz kurmak
 * ```ts
 * import {
 *   AuthService,
 *   Command,
 *   DispatchGateway,
 *   HttpClient,
 *   PageName,
 *   resolveClientOptions,
 * } from '@yankikucuk/efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const gateway = new DispatchGateway(http, auth)
 * const rows = await gateway.call<unknown>(Command.LIST_INVOICES, PageName.INTERACTIVE_DRAFTS, {
 *   baslangic: '01/09/2026',
 *   bitis: '30/09/2026',
 *   hangiTip: '5000/30000',
 * })
 * console.log(rows)
 * ```
 */
export class DispatchGateway {
  /**
   * @param http İstekleri gönderecek HTTP istemcisi.
   * @param tokens Token sağlayıcı; süre dolumu doğrulandığında
   *   `clearToken()` bu nesne üzerinde çağrılır. `AuthService` bu sözleşmeyi
   *   uygular.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenProvider,
  ) {}

  /**
   * Komutu çalıştırır ve portal zarfının `data` alanını döndürür.
   * Dönüş tipi çağıran tarafından bildirilir; ayrıştırıcı yapıyı doğrulamaz.
   *
   * Açık bir oturum zaman aşımı metni (`SESSION_TIMEOUT_PATTERN`) görülürse
   * token DOĞRUDAN temizlenir — bu metin belirsiz değildir, prob'a gerek
   * yoktur (round 3 madde 2).
   *
   * Belirsiz yetki-şekilli bir hata alındığında (`AUTH_EXPIRED_PATTERN`) ise
   * token hemen temizlenmez: önce `probeTokenIsExpired()` ile doğrulanır
   * (bkz. o sabitin belgesi). Prob, bu metodu DEĞİL — kendi içindeki çıplak
   * `dispatch()`'i çağırır; bu yüzden prob'un kendi başarısızlığı ikinci bir
   * prob TETİKLEYEMEZ (özyineleme yapısal olarak imkânsız, bir bayrakla
   * değil).
   *
   * @typeParam T Çağıranın beklediği `data` tipi. Ayrıştırıcı yapıyı
   *   DOĞRULAMAZ — bu bir iddiadır, garanti değil.
   * @param command Portal `cmd` değeri; `Command` sabitlerinden biri.
   *   Yeniden denenebilirlik bu değere göre belirlenir.
   * @param pageName Portal `pageName` değeri; `PageName` sabitlerinden biri.
   *   YANLIŞ ekran adı "Bu işlem için yetkiniz yok" hatasına yol açar.
   * @param payload Komutun gövdesi; `jp` alanına `JSON.stringify` ile
   *   yazılır. Boş komutlarda `{}` verin.
   * @returns Portal zarfının `data` alanı, `T` olarak.
   * @throws {EArsivAuthError} Oturum yoksa; portal açık zaman aşımı metni
   *   döndürürse (token temizlenir, prob atılmaz); ya da yetki-şekilli bir
   *   hata `getUserMenu` probuyla süre dolumu olarak DOĞRULANIRSA (token
   *   temizlenir).
   * @throws {EArsivApiError} Portal isteği reddederse — prob token'ın SAĞLAM
   *   olduğunu gösterdiğinde orijinal hata aynen yükselir.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa.
   *
   * @example
   * ```ts
   * import {
   *   AuthService,
   *   Command,
   *   DispatchGateway,
   *   HttpClient,
   *   PageName,
   *   resolveClientOptions,
   * } from '@yankikucuk/efatura'
   *
   * const options = resolveClientOptions({ environment: 'test' })
   * const http = new HttpClient(options)
   * const auth = new AuthService(http, options)
   * await auth.loginWithTestUser()
   *
   * const gateway = new DispatchGateway(http, auth)
   * const user = await gateway.call<Record<string, unknown>>(
   *   Command.GET_USER_INFO,
   *   PageName.USER,
   *   {},
   * )
   * console.log(user.unvan)
   * ```
   */
  async call<T>(
    command: CommandName,
    pageName: PageNameValue,
    payload: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await this.dispatch<T>(command, pageName, payload)
    } catch (error) {
      if (error instanceof EArsivApiError) {
        if (SESSION_TIMEOUT_PATTERN.test(error.message)) {
          // Metin süre dolumunu AÇIKÇA söylüyor — belirsizlik yok, prob
          // gereksiz. Doğrudan temizle ve fırlat.
          this.tokens.clearToken()
          throw new EArsivAuthError(
            'Oturum süresi doldu (portal: "zaman aşımına uğradı"); token temizlendi. ' +
              'Yeniden login() çağırın.',
            { cause: error },
          )
        }
        if (AUTH_EXPIRED_PATTERN.test(error.message)) {
          const expired = await this.probeTokenIsExpired()
          if (!expired) {
            // Prob sağlıklı: token geçerli, bu gerçek bir yetki reddiydi.
            // Token'a DOKUNULMAZ; orijinal hata aynen yükselir.
            throw error
          }
          this.tokens.clearToken()
          throw new EArsivAuthError(
            'Oturum süresi dolmuş veya token geçersiz; portal yetki hatası döndürdü. ' +
              'Yeniden login() çağırın.',
            { cause: error },
          )
        }
      }
      throw error
    }
  }

  /** İstek gönderir ve zarfı çözer. `call()`'ın yetki-hatası tespiti YOKTUR — prob bunu kasıtlı olarak kullanır. */
  private async dispatch<T>(
    command: CommandName,
    pageName: PageNameValue,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const callId = randomUUID()
    const raw = await this.http.postForm(
      Endpoint.DISPATCH,
      {
        cmd: command,
        callid: callId,
        pageName,
        token: this.tokens.getToken(),
        jp: JSON.stringify(payload),
      },
      { retryable: RETRYABLE_COMMANDS.has(command) },
    )
    return parsePortalResponse(raw, { command, callId }) as T
  }

  /**
   * Token'ın gerçekten süresi dolmuş mu, yoksa bu metni üreten şey gerçek
   * bir yetki kısıtlaması mı — herhangi bir kimlik doğrulanmış kullanıcının
   * çalıştırabildiği zararsız bir komutla (`getUserMenu`) doğrular.
   *
   * - Prob başarılı olursa: token sağlıklı → `false` (süresi dolmamış).
   * - Prob AYNI yetki-şekilli metinle başarısız olursa: token gerçekten
   *   ölü → `true`.
   * - Prob BAŞKA bir nedenle (ör. geçici ağ hatası) başarısız olursa: bu
   *   sonucu DOĞRULAMAZ — güvenli taraf, canlı bir oturumu yanlışlıkla
   *   yok etmemektir, bu yüzden `false` döner (temizlenmez).
   */
  private async probeTokenIsExpired(): Promise<boolean> {
    try {
      await this.dispatch(Command.GET_USER_MENU, PageName.MAIN_MENU, { ANONIM_LOGIN: '1' })
      return false
    } catch (probeError) {
      return probeError instanceof EArsivApiError && AUTH_EXPIRED_PATTERN.test(probeError.message)
    }
  }
}
