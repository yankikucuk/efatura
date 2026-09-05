/** İtiraz tebliğ yöntemi — portal RG_TASLAKLAR tanımından alındı. */
export const DisputeMethod = {
  NOTARY: 'NOTER',
  REGISTERED_MAIL: 'TAAHHUTLU_MEKTUP',
  TELEGRAM: 'TELGRAF',
  KEP: 'KEP',
} as const
export type DisputeMethodCode = (typeof DisputeMethod)[keyof typeof DisputeMethod]

/** Gelen talebe verilen cevap — `talepCevabi` alanı. */
export const DisputeAnswer = { ACCEPT: '1', REJECT: '2' } as const
export type DisputeAnswerValue = (typeof DisputeAnswer)[keyof typeof DisputeAnswer]

/** Talebin güncel durumu — `iptalItirazDurumu` alanı. */
export const DisputeStatus = {
  CREATED: '0',
  ACCEPTED: '1',
  REJECTED: '2',
  CANCELLED: '3',
} as const
export type DisputeStatusValue = (typeof DisputeStatus)[keyof typeof DisputeStatus]

/** Talebin türü — `iptalItiraz` alanı. */
export const DisputeKind = { CANCELLATION: '0', OBJECTION: '1' } as const
export type DisputeKindValue = (typeof DisputeKind)[keyof typeof DisputeKind]
