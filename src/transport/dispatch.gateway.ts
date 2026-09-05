import { randomUUID } from 'node:crypto'

import type { CommandName, PageNameValue } from '../constants/index.js'

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
}

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
    const raw = await this.http.postForm(Endpoint.DISPATCH, {
      cmd: command,
      callid: callId,
      pageName,
      token: this.tokens.getToken(),
      jp: JSON.stringify(payload),
    })
    return parsePortalResponse(raw, { command, callId }) as T
  }
}
