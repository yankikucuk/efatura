// eslint-disable-next-line no-restricted-imports -- yalnızca tip import'u, çalışma zamanı bağımlılığı yok
import type { InvoiceSummary } from '../invoice/index.js'

/**
 * `sendSmsCode()` sonucu — açılmış SMS doğrulama oturumu.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { SmsChallenge } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'production' })
 * await client.login({ username: '1111111111', password: 'gizli' })
 *
 * const challenge: SmsChallenge = await client.sendSmsCode()
 * console.log(`${challenge.phoneNumber} numarasına kod gönderildi.`)
 * ```
 */
export interface SmsChallenge {
  /** Portalın ürettiği işlem kimliği; doğrulama adımında geri gönderilir. */
  operationId: string
  /** Kodun gönderildiği numara — verilmemişse portaldan sorgulanan numara. */
  phoneNumber: string
}

/**
 * `sendSmsCode()` seçenekleri.
 *
 * @example
 * ```ts
 * import type { SendSmsOptions } from '@yankikucuk/efatura'
 *
 * // Numara verilmezse portaldan kayıtlı numara ayrıca sorgulanır.
 * const options: SendSmsOptions = { phoneNumber: '5551112233' }
 * console.log(options.phoneNumber)
 * ```
 */
export interface SendSmsOptions {
  /** Verilmezse portaldan kayıtlı numara sorgulanır. */
  phoneNumber?: string
}

/**
 * `verifySmsCode()` girdisi.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { VerifySmsInput } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'production' })
 * await client.login({ username: '1111111111', password: 'gizli' })
 *
 * const challenge = await client.sendSmsCode()
 * const input: VerifySmsInput = {
 *   code: '123456',
 *   operationId: challenge.operationId,
 *   invoices: await client.listDrafts(new Date(), new Date()),
 * }
 * await client.verifySmsCode(input)
 * ```
 */
export interface VerifySmsInput {
  /** SMS ile gelen doğrulama kodu. */
  code: string
  /** `sendSmsCode()` sonucundaki `operationId` — birebir aynı değer. */
  operationId: string
  /**
   * İmzalanacak faturaların özet satırları. Listeleme yöntemlerinden dönen
   * nesneler doğrudan verilebilir; liste BOŞ OLAMAZ.
   */
  invoices: readonly InvoiceSummary[]
}
