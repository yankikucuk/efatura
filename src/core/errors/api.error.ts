import { EArsivError } from './base.error.js'

/**
 * `EArsivApiError`'un taşıdığı çağrı bağlamı.
 *
 * @example
 * ```ts
 * import { Command, EArsivApiError } from '@yankikucuk/efatura'
 * import type { ApiErrorContext } from '@yankikucuk/efatura'
 *
 * const context: ApiErrorContext = {
 *   command: Command.CREATE_INVOICE,
 *   callId: 'b7f1c3f0-0c1b-4a1e-9a2d-3f5c8d9e0a1b',
 *   raw: { data: 'Ettn ya eksik ya boş' },
 *   code: '2-1109',
 *   messages: ['Bu işlem için yetkiniz yok'],
 * }
 * const error = new EArsivApiError('Portal isteği reddetti.', context)
 * console.log(error.code, error.messages)
 * ```
 */
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

/**
 * Portal iş mantığı veya yetki hatası.
 *
 * Portal HER hatayı HTTP 200 ile bildirir; bu sınıf, yanıt zarfının üç ayrı
 * hata biçiminden (üst seviye `error`, `data.hata`, düz string `data`)
 * herhangi birinde başarısızlık tespit edildiğinde fırlatılır. Yani "istek
 * ağa çıktı, portal anladı ve REDDETTİ" durumudur — girdiniz biçimsel olarak
 * geçersizse `EArsivValidationError`, ağa hiç çıkılamadıysa
 * `EArsivNetworkError` gelir.
 *
 * @example Hata kodunu ve portalın kendi mesajlarını okumak
 * ```ts
 * import { EArsivApiError, EArsivClient, Unit } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * try {
 *   await client.createDraft({
 *     buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *     lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 *   })
 * } catch (error) {
 *   if (error instanceof EArsivApiError) {
 *     console.error('Komut:', error.command)
 *     console.error('Korelasyon kimliği:', error.callId)
 *     console.error('Kod:', error.code ?? '(yok)')
 *     console.error('Portal mesajları:', error.messages)
 *     console.error('Ham yanıt:', error.raw)
 *   }
 * }
 * ```
 */
export class EArsivApiError extends EArsivError {
  /** Her zaman `'api'`. */
  readonly kind = 'api'
  /** Hatanın oluştuğu portal komutu (`cmd`). */
  readonly command: string
  /** İsteğin `callid` korelasyon kimliği — portal destek kaydında işe yarar. */
  readonly callId: string
  /** Portalın ham yanıtı; hiçbir alan yutulmaz. */
  readonly raw: unknown
  /** Portal metninden ayrıştırılan hata kodu; kalıp yoksa `undefined`. */
  readonly code: string | undefined
  /** Portalın `messages` dizisinden toplanan metinler; yoksa boş dizi. */
  readonly messages: readonly string[]

  /**
   * @param message Hata metni; genellikle portalın kendi cümlesini içerir.
   * @param context Çağrı bağlamı — komut, korelasyon kimliği, ham yanıt ve
   *   varsa kod/mesajlar. `messages` verilmezse boş diziye düşer.
   */
  constructor(message: string, context: ApiErrorContext) {
    super(message)
    this.command = context.command
    this.callId = context.callId
    this.raw = context.raw
    this.code = context.code
    this.messages = context.messages ?? []
  }
}
