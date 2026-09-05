import type { ResolvedClientOptions } from '../config/index.js'
import { EArsivNetworkError } from '../core/index.js'

import type { EndpointPath } from './endpoints.js'
import { buildPortalHeaders } from './headers.js'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 5xx geçicidir ve yeniden denenir; 4xx kalıcıdır ve denenmez. */
const isRetryableStatus = (status: number): boolean => status >= 500

/** Portalın iki endpoint ailesi için ince fetch sarmalayıcısı. */
export class HttpClient {
  private readonly headers: Record<string, string>

  constructor(private readonly options: ResolvedClientOptions) {
    this.headers = buildPortalHeaders(options.baseUrl, options.userAgent)
  }

  /** Form-urlencoded POST; yanıtı JSON olarak çözer. */
  async postForm(path: EndpointPath, fields: Record<string, string>): Promise<unknown> {
    const url = `${this.options.baseUrl}${path}`
    const body = new URLSearchParams(fields).toString()
    const response = await this.send(url, { method: 'POST', headers: this.headers, body })
    const text = await response.text()
    try {
      return JSON.parse(text) as unknown
    } catch (cause) {
      throw new EArsivNetworkError('Portal JSON olarak ayrıştırılamayan bir yanıt döndürdü.', {
        url,
        status: response.status,
        attempts: this.options.retry.attempts,
        cause,
      })
    }
  }

  /** İkili GET; belge paketi indirmek için. */
  async getBinary(path: EndpointPath, query: Record<string, string>): Promise<Uint8Array> {
    const url = `${this.options.baseUrl}${path}?${new URLSearchParams(query).toString()}`
    const response = await this.send(url, { method: 'GET', headers: this.headers })
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      throw new EArsivNetworkError(
        'Portal boş bir belge paketi döndürdü. ETTN veya onay durumu hatalı olabilir.',
        { url, status: response.status, attempts: 1 },
      )
    }
    return bytes
  }

  /** Zaman aşımı ve üstel geri çekilmeli yeniden deneme. */
  private async send(url: string, init: RequestInit): Promise<Response> {
    const { attempts, backoffMs } = this.options.retry
    let lastCause: unknown

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.options.fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.options.timeoutMs),
        })

        if (response.ok) return response

        if (!isRetryableStatus(response.status) || attempt === attempts) {
          throw new EArsivNetworkError(`Portal HTTP ${String(response.status)} döndürdü.`, {
            url,
            status: response.status,
            attempts: attempt,
          })
        }
        lastCause = new Error(`HTTP ${String(response.status)}`)
      } catch (cause) {
        // Kalıcı hatayı yeniden denemeden yukarı ilet.
        if (cause instanceof EArsivNetworkError) throw cause
        if (attempt === attempts) {
          throw new EArsivNetworkError('Portala ulaşılamadı.', {
            url,
            attempts: attempt,
            cause,
          })
        }
        lastCause = cause
      }

      this.options.logger.debug('Portal isteği yeniden deneniyor', {
        url,
        attempt,
        cause: String(lastCause),
      })
      await sleep(backoffMs * 2 ** (attempt - 1))
    }

    // Döngü her koşulda ya döner ya fırlatır; bu satır yalnızca tip güvenliği için.
    throw new EArsivNetworkError('Portala ulaşılamadı.', { url, attempts, cause: lastCause })
  }
}
