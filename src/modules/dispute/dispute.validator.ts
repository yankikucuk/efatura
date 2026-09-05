import { DisputeAnswer } from '../../constants/index.js'
import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'

import type {
  CancellationRequestInput,
  DisputeResponseInput,
  IncomingObjectionRequestInput,
  ObjectionRequestInput,
} from './dispute.types.js'

const isBlank = (value: unknown): boolean => typeof value !== 'string' || value.trim().length === 0

const raise = (issues: ValidationIssue[]): void => {
  if (issues.length > 0) {
    // Fatura doğrulayıcısıyla aynı biçim: üst seviye mesaj sorunların
    // kendisini taşır, yalnızca sayısını değil.
    throw new EArsivValidationError(
      `Talep doğrulama başarısız: ${issues.map((issue) => issue.message).join(' | ')}`,
      issues,
    )
  }
}

/**
 * Portalın kendi istemci kontrolü: iptal gerekçesi boş olamaz.
 *
 * `DisputeService.createCancellationRequest` bunu kendisi çağırır; doğrudan
 * çağırmanız yalnızca formu göndermeden ÖNCE doğrulamak isterseniz gerekir.
 *
 * @param input Denetlenecek iptal talebi girdisi.
 * @returns Doğrulama geçerse hiçbir şey (`void`).
 * @throws {EArsivValidationError} `ettn` veya `reason` boş/yalnızca boşluksa.
 *   Tüm sorunlar tek hatada toplanır.
 *
 * @example
 * ```ts
 * import { EArsivValidationError, validateCancellationRequest } from '@yankikucuk/efatura'
 *
 * try {
 *   validateCancellationRequest({ ettn: '', reason: '' })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) {
 *     console.error(error.issues.map((issue) => issue.path)) // ['ettn', 'reason']
 *   }
 * }
 * ```
 */
export function validateCancellationRequest(input: CancellationRequestInput): void {
  const issues: ValidationIssue[] = []
  if (isBlank(input.ettn)) issues.push({ path: 'ettn', message: 'ETTN boş olamaz.' })
  if (isBlank(input.reason)) {
    issues.push({ path: 'reason', message: 'Lütfen açıklama alanına iptal gerekçenizi yazınız.' })
  }
  raise(issues)
}

/**
 * `ObjectionRequestInput`'un ortak yedi alanını doğrular — hem kendi
 * belgenize (`validateObjectionRequest`) hem de adınıza düzenlenmiş bir
 * belgeye (`validateIncomingObjectionRequest`) itiraz için PAYLAŞILAN kural
 * kümesi. Portalın kendi istemci kontrolü: belge sayısı, belge tarihi ve
 * gerekçe zorunludur.
 */
function objectionCommonIssues(input: ObjectionRequestInput): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (isBlank(input.ettn)) issues.push({ path: 'ettn', message: 'ETTN boş olamaz.' })
  if (isBlank(input.referenceDocumentId)) {
    issues.push({
      path: 'referenceDocumentId',
      message: 'Lütfen itiraz tebligatının belge sayısını giriniz.',
    })
  }
  if (isBlank(input.referenceDocumentDate)) {
    if (!(input.referenceDocumentDate instanceof Date)) {
      issues.push({
        path: 'referenceDocumentDate',
        message: 'Lütfen itiraz tebligatının belge tarihini giriniz.',
      })
    }
  }
  if (isBlank(input.reason)) {
    issues.push({ path: 'reason', message: 'Lütfen açıklama alanına itiraz gerekçenizi yazınız.' })
  }
  return issues
}

/**
 * Kendi düzenlediğiniz bir belgeye itiraz talebi doğrular (yedi alanlı
 * varyant, `RG_TASLAKLAR`).
 */
export function validateObjectionRequest(input: ObjectionRequestInput): void {
  raise(objectionCommonIssues(input))
}

/**
 * Adınıza düzenlenmiş (portal veya entegratör) bir belgeye itiraz talebi
 * doğrular — on bir alanlı varyant, `RG_ALICI_TASLAKLAR`. Ortak yedi alana
 * ek olarak dördü BİRLİKTE zorunludur: `invoiceOid`, `totalAmount`,
 * `sellerTaxOrIdentityNumber`, `documentNumber`. Bu dört alan
 * `IncomingObjectionRequestInput`'ta zaten (opsiyonel değil) ZORUNLU
 * olduğundan burada "ikisi verilip ikisi unutulur" durumu YOKTUR — yalnızca
 * her birinin boş/geçersiz OLUP OLMADIĞI kontrol edilir.
 *
 * @param input Denetlenecek gelen-belge itiraz girdisi.
 * @returns Doğrulama geçerse hiçbir şey (`void`).
 * @throws {EArsivValidationError} Ortak yedi alandan biri boşsa; `invoiceOid`,
 *   `sellerTaxOrIdentityNumber` veya `documentNumber` boşsa; ya da
 *   `totalAmount` sonlu bir sayı değilse veya negatifse.
 *
 * @example
 * ```ts
 * import { DisputeMethod, EArsivValidationError, validateIncomingObjectionRequest } from '@yankikucuk/efatura'
 *
 * try {
 *   validateIncomingObjectionRequest({
 *     ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *     invoiceOid: '4021',
 *     totalAmount: -1,
 *     sellerTaxOrIdentityNumber: '1111111111',
 *     documentNumber: 'EAR2026000000123',
 *     method: DisputeMethod.KEP,
 *     referenceDocumentId: '2026/1234',
 *     referenceDocumentDate: '05/09/2026',
 *     reason: 'Sipariş edilmedi.',
 *   })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues[0]?.path) // 'totalAmount'
 * }
 * ```
 */
export function validateIncomingObjectionRequest(input: IncomingObjectionRequestInput): void {
  const issues = objectionCommonIssues(input)
  if (isBlank(input.invoiceOid)) {
    issues.push({
      path: 'invoiceOid',
      message: 'Faturanın portal içi kaydı (invoiceOid) boş olamaz.',
    })
  }
  if (isBlank(input.sellerTaxOrIdentityNumber)) {
    issues.push({
      path: 'sellerTaxOrIdentityNumber',
      message: 'Belgeyi düzenleyen satıcının VKN veya TCKN bilgisi boş olamaz.',
    })
  }
  if (isBlank(input.documentNumber)) {
    issues.push({ path: 'documentNumber', message: 'Belge numarası boş olamaz.' })
  }
  if (typeof input.totalAmount !== 'number' || !Number.isFinite(input.totalAmount)) {
    issues.push({ path: 'totalAmount', message: 'Toplam tutar geçerli, sonlu bir sayı olmalı.' })
  } else if (input.totalAmount < 0) {
    issues.push({ path: 'totalAmount', message: 'Toplam tutar negatif olamaz.' })
  }
  raise(issues)
}

/**
 * Portalın kendi istemci kontrolü: ret cevabında gerekçe zorunludur.
 *
 * @param input Denetlenecek cevap girdisi.
 * @returns Doğrulama geçerse hiçbir şey (`void`).
 * @throws {EArsivValidationError} `disputeId` boşsa ya da `answer`
 *   `DisputeAnswer.REJECT` iken `rejectionReason` boşsa. KABUL cevabında
 *   gerekçe aranmaz.
 *
 * @example
 * ```ts
 * import { DisputeAnswer, EArsivValidationError, validateDisputeResponse } from '@yankikucuk/efatura'
 *
 * try {
 *   validateDisputeResponse({ disputeId: '1234', answer: DisputeAnswer.REJECT })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues[0]?.path)
 *   // 'rejectionReason'
 * }
 * ```
 */
export function validateDisputeResponse(input: DisputeResponseInput): void {
  const issues: ValidationIssue[] = []
  if (isBlank(input.disputeId)) {
    issues.push({ path: 'disputeId', message: 'Talep kimliği boş olamaz.' })
  }
  if (input.answer === DisputeAnswer.REJECT && isBlank(input.rejectionReason)) {
    issues.push({
      path: 'rejectionReason',
      message: 'Lütfen açıklama alanına ret gerekçenizi yazınız.',
    })
  }
  raise(issues)
}
