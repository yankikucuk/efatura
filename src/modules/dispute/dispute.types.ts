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

/**
 * Adınıza düzenlenmiş (portal veya entegratör) bir belgeye itiraz talebi —
 * spec §9.2'nin belgelediği asıl kullanım durumu.
 *
 * Portalın `RG_ALICI_TASLAKLAR` / `RG_ALICI_ENTEGRATOR` ekranlarının
 * gönderdiği 11 alanlı yükün karşılığıdır: `ObjectionRequestInput`'un yedi
 * alanına ek olarak belgeyi düzenleyen SATICININ kimliği ve belgenin portal
 * içi kaydı gerekir (bkz. rapor, Fix 2). Bu dört alan ayrı, kendi türünde
 * ZORUNLU olduğu için "iki alan verilip ikisi unutulur" durumu derleme
 * zamanında imkânsızdır.
 */
export interface IncomingObjectionRequestInput extends ObjectionRequestInput {
  /** `faturaOid` — belgenin portal içi kaydı (liste satırından alınır). */
  invoiceOid: string
  /** `toplamTutar` — belgenin toplam tutarı (lira). */
  totalAmount: number
  /** `saticiVknTckn` — belgeyi düzenleyen satıcının VKN/TCKN'i. */
  sellerTaxOrIdentityNumber: string
  /** `belgeNumarasi` — belge (fatura) numarası. */
  documentNumber: string
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
