/**
 * İtiraz tebliğ yöntemi — portal RG_TASLAKLAR tanımından alındı.
 *
 * `createObjectionRequest` ve `createObjectionRequestForIncoming` girdilerinde
 * `method` alanında zorunludur; iptal taleplerinde kullanılmaz.
 *
 * @example
 * ```ts
 * import { DisputeMethod } from '@yankikucuk/efatura'
 * import type { ObjectionRequestInput } from '@yankikucuk/efatura'
 *
 * const input: ObjectionRequestInput = {
 *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *   method: DisputeMethod.KEP,
 *   referenceDocumentId: '2026/1234',
 *   referenceDocumentDate: '05/09/2026',
 *   reason: 'Hizmet teslim edilmedi.',
 * }
 * console.log(input.method)
 * ```
 */
export const DisputeMethod = {
  /** `NOTER` — noter aracılığıyla tebliğ. */
  NOTARY: 'NOTER',
  /** `TAAHHUTLU_MEKTUP` — iadeli taahhütlü mektup. */
  REGISTERED_MAIL: 'TAAHHUTLU_MEKTUP',
  /** `TELGRAF` — telgraf. */
  TELEGRAM: 'TELGRAF',
  /** `KEP` — kayıtlı elektronik posta. */
  KEP: 'KEP',
} as const
/**
 * {@link DisputeMethod} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { DisputeMethod } from '@yankikucuk/efatura'
 * import type { DisputeMethodCode } from '@yankikucuk/efatura'
 *
 * const method: DisputeMethodCode = DisputeMethod.NOTARY
 * console.log(method)
 * ```
 */
export type DisputeMethodCode = (typeof DisputeMethod)[keyof typeof DisputeMethod]

/**
 * Gelen talebe verilen cevap — `talepCevabi` alanı.
 *
 * `REJECT` seçildiğinde `rejectionReason` ZORUNLUDUR; verilmezse istek ağa
 * çıkmadan `EArsivValidationError` ile reddedilir.
 *
 * @example
 * ```ts
 * import { DisputeAnswer, EArsivClient } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * await client.respondToDisputeRequest({
 *   disputeId: '1234',
 *   answer: DisputeAnswer.ACCEPT,
 * })
 * ```
 */
export const DisputeAnswer = {
  /** `'1'` — talebi kabul et. */
  ACCEPT: '1',
  /** `'2'` — talebi reddet; gerekçe zorunludur. */
  REJECT: '2',
} as const
/**
 * {@link DisputeAnswer} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { DisputeAnswer } from '@yankikucuk/efatura'
 * import type { DisputeAnswerValue } from '@yankikucuk/efatura'
 *
 * const answer: DisputeAnswerValue = DisputeAnswer.REJECT
 * console.log(answer)
 * ```
 */
export type DisputeAnswerValue = (typeof DisputeAnswer)[keyof typeof DisputeAnswer]

/**
 * Talebin güncel durumu — `iptalItirazDurumu` alanı.
 *
 * `listDisputeRequests` satırlarının `status` alanında döner.
 *
 * @example Yalnızca cevap bekleyen talepleri süzmek
 * ```ts
 * import { DisputeStatus, EArsivClient } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const requests = await client.listDisputeRequests(new Date(), new Date())
 * const bekleyen = requests.filter((request) => request.status === DisputeStatus.CREATED)
 * console.log(bekleyen.length)
 * ```
 */
export const DisputeStatus = {
  /** `'0'` — talep oluşturuldu, henüz cevaplanmadı. */
  CREATED: '0',
  /** `'1'` — talep kabul edildi. */
  ACCEPTED: '1',
  /** `'2'` — talep reddedildi. */
  REJECTED: '2',
  /** `'3'` — talep iptal edildi. */
  CANCELLED: '3',
} as const
/**
 * {@link DisputeStatus} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { DisputeStatus } from '@yankikucuk/efatura'
 * import type { DisputeStatusValue } from '@yankikucuk/efatura'
 *
 * const status: DisputeStatusValue = DisputeStatus.ACCEPTED
 * console.log(status)
 * ```
 */
export type DisputeStatusValue = (typeof DisputeStatus)[keyof typeof DisputeStatus]

/**
 * Talebin türü — `iptalItiraz` alanı.
 *
 * @example
 * ```ts
 * import { DisputeKind, EArsivClient } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const requests = await client.listDisputeRequests(new Date(), new Date())
 * for (const request of requests) {
 *   console.log(request.kind === DisputeKind.CANCELLATION ? 'iptal' : 'itiraz')
 * }
 * ```
 */
export const DisputeKind = {
  /** `'0'` — iptal talebi. */
  CANCELLATION: '0',
  /** `'1'` — itiraz talebi. */
  OBJECTION: '1',
} as const
/**
 * {@link DisputeKind} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { DisputeKind } from '@yankikucuk/efatura'
 * import type { DisputeKindValue } from '@yankikucuk/efatura'
 *
 * const kind: DisputeKindValue = DisputeKind.OBJECTION
 * console.log(kind)
 * ```
 */
export type DisputeKindValue = (typeof DisputeKind)[keyof typeof DisputeKind]
