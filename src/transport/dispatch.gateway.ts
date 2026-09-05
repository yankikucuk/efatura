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

/** `/dispatch` endpoint'ine komut gönderen ince katman. */
export class DispatchGateway {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenProvider,
  ) {}

  /**
   * Komutu çalıştırır ve portal zarfının `data` alanını döndürür.
   * Dönüş tipi çağıran tarafından bildirilir; ayrıştırıcı yapıyı doğrulamaz.
   *
   * Yetki-şekilli bir hata alındığında token hemen temizlenmez: önce
   * `probeTokenIsExpired()` ile doğrulanır (bkz. `AUTH_EXPIRED_PATTERN`
   * belgesi). Prob, bu metodu DEĞİL — kendi içindeki çıplak `dispatch()`'i
   * çağırır; bu yüzden prob'un kendi başarısızlığı ikinci bir prob
   * TETİKLEYEMEZ (özyineleme yapısal olarak imkânsız, bir bayrakla değil).
   */
  async call<T>(
    command: CommandName,
    pageName: PageNameValue,
    payload: Record<string, unknown>,
  ): Promise<T> {
    try {
      return (await this.dispatch<T>(command, pageName, payload)) as T
    } catch (error) {
      if (error instanceof EArsivApiError && AUTH_EXPIRED_PATTERN.test(error.message)) {
        const expired = await this.probeTokenIsExpired()
        if (!expired) {
          // Prob sağlıklı: token geçerli, bu gerçek bir yetki reddiydi.
          // Token'a DOKUNULMAZ; orijinal hata aynen yükselir.
          throw error
        }
        this.tokens.clearToken()
        throw new EArsivAuthError(
          "Oturum token'ının süresi dolmuş veya geçersiz; portal yetki hatası döndürdü. " +
            'Yeniden login() çağırın.',
          { cause: error },
        )
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
