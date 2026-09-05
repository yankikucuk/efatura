import { DisputeAnswer } from '../../constants/index.js'
import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'

import type {
  CancellationRequestInput,
  DisputeResponseInput,
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

/** Portalın kendi istemci kontrolü: iptal gerekçesi boş olamaz. */
export function validateCancellationRequest(input: CancellationRequestInput): void {
  const issues: ValidationIssue[] = []
  if (isBlank(input.ettn)) issues.push({ path: 'ettn', message: 'ETTN boş olamaz.' })
  if (isBlank(input.reason)) {
    issues.push({ path: 'reason', message: 'Lütfen açıklama alanına iptal gerekçenizi yazınız.' })
  }
  raise(issues)
}

/**
 * Portalın kendi istemci kontrolü: itirazda belge sayısı, belge tarihi ve
 * gerekçe zorunludur.
 */
export function validateObjectionRequest(input: ObjectionRequestInput): void {
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
  raise(issues)
}

/** Portalın kendi istemci kontrolü: ret cevabında gerekçe zorunludur. */
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
