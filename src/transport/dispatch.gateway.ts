import { randomUUID } from 'node:crypto'

import { type CommandName, type PageNameValue, RETRYABLE_COMMANDS } from '../constants/index.js'
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
 * Portalın sunucu tarafı token süresi dolumunu bildirdiği metin. Bu metin
 * `EArsivApiError` olarak yükselir ve gerçek bir yetki hatasından ayırt
 * edilemez — bu yüzden burada özel olarak yakalanır, token temizlenir ve
 * `EArsivAuthError`'a çevrilir (spec §4.2).
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
   */
  async call<T>(
    command: CommandName,
    pageName: PageNameValue,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const callId = randomUUID()
    try {
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
    } catch (error) {
      if (error instanceof EArsivApiError && AUTH_EXPIRED_PATTERN.test(error.message)) {
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
}
