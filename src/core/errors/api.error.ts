import { EArsivError } from './base.error.js'

export interface ApiErrorContext {
  /** Portala gönderilen `cmd` değeri. */
  command: string
  /** İsteğin `callid` korelasyon kimliği. */
  callId: string
  /** Portalın ham yanıtı — hiçbir şey yutulmaz. */
  raw: unknown
  /** Portal mesajından ayrıştırılan hata kodu, ör. "2-1109". */
  code?: string
  /** `messages[].text` alanlarından toplanan metinler. */
  messages?: readonly string[]
}

/** Portal iş mantığı veya yetki hatası. */
export class EArsivApiError extends EArsivError {
  readonly kind = 'api'
  readonly command: string
  readonly callId: string
  readonly raw: unknown
  readonly code: string | undefined
  readonly messages: readonly string[]

  constructor(message: string, context: ApiErrorContext) {
    super(message)
    this.command = context.command
    this.callId = context.callId
    this.raw = context.raw
    this.code = context.code
    this.messages = context.messages ?? []
  }
}
