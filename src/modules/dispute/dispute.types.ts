import type {
  ApprovalStatusValue,
  DisputeAnswerValue,
  DisputeKindValue,
  DisputeMethodCode,
  DisputeStatusValue,
  DocumentTypeCode,
} from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'

export interface CancellationRequestInput {
  ettn: string
  /** İptal gerekçesi; portal boş bırakılmasına izin vermez. */
  reason: string
  /** Varsayılan `Onaylandı` — talep yalnızca imzalı belge için açılabilir. */
  approvalStatus?: ApprovalStatusValue
  documentType?: DocumentTypeCode
}

export interface ObjectionRequestInput {
  ettn: string
  /** Tebliğ yöntemi: NOTER, TAAHHUTLU_MEKTUP, TELGRAF veya KEP. */
  method: DisputeMethodCode
  /** İtiraz tebligatının belge numarası/sayısı. */
  referenceDocumentId: string
  referenceDocumentDate: DateInput
  reason: string
  approvalStatus?: ApprovalStatusValue
  documentType?: DocumentTypeCode
}

export interface DisputeResponseInput {
  /** Portal `iptalItirazOid` alanı. */
  disputeId: string
  answer: DisputeAnswerValue
  /** Ret cevabında zorunlu. */
  rejectionReason?: string
  documentType?: DocumentTypeCode
}

/** Gelen iptal/itiraz talebi satırı. */
export interface DisputeRequest {
  disputeId: string
  documentNumber: string
  documentType: DocumentTypeCode
  /** `0` iptal talebi, `1` itiraz talebi. */
  kind: DisputeKindValue
  /** `0` oluştu, `1` kabul, `2` ret, `3` iptal. */
  status: DisputeStatusValue
  method: DisputeMethodCode | ''
}
