import { EArsivError } from './base.error.js'

export interface NetworkErrorContext {
  url: string
  /** Yanıt alındıysa HTTP durum kodu. */
  status?: number
  /** Vazgeçmeden önce yapılan toplam deneme sayısı. */
  attempts: number
  cause?: unknown
}

/** Zaman aşımı, DNS, bağlantı kesintisi veya HTTP 5xx. */
export class EArsivNetworkError extends EArsivError {
  readonly kind = 'network'
  readonly url: string
  readonly status: number | undefined
  readonly attempts: number

  constructor(message: string, context: NetworkErrorContext) {
    super(message, context.cause === undefined ? undefined : { cause: context.cause })
    this.url = context.url
    this.status = context.status
    this.attempts = context.attempts
  }
}
