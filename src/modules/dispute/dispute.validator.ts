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
      message: "Belgeyi düzenleyen satıcının VKN/TCKN'i boş olamaz.",
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
