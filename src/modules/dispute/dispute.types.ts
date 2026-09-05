import type {
  ApprovalStatusValue,
  DisputeAnswerValue,
  DisputeKindValue,
  DisputeMethodCode,
  DisputeStatusValue,
  DocumentTypeCode,
} from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'

/**
 * `createCancellationRequest` girdisi — KENDİ kestiğiniz bir belgenin iptali.
 *
 * Talep yalnızca ONAYLANMIŞ (imzalanmış) bir belge için ve belge başına BİR
 * KEZ açılabilir.
 *
 * @example
 * ```ts
 * import type { CancellationRequestInput } from '@yankikucuk/efatura'
 *
 * const input: CancellationRequestInput = {
 *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *   reason: 'Fatura yanlış mükellefe düzenlendi.',
 * }
 * console.log(input.reason)
 * ```
 */
export interface CancellationRequestInput {
  /** İptal edilecek belgenin ETTN'i. Boş olamaz. */
  ettn: string
  /** İptal gerekçesi; portal boş bırakılmasına izin vermez. */
  reason: string
  /** Varsayılan `Onaylandı` — talep yalnızca imzalı belge için açılabilir. */
  approvalStatus?: ApprovalStatusValue
  /** Belge türü; varsayılan `'FATURA'`. */
  documentType?: DocumentTypeCode
}

/**
 * `createObjectionRequest` girdisi — KENDİ düzenlediğiniz bir belgeye itiraz
 * (yedi alanlı yük, `RG_TASLAKLAR`).
 *
 * @example
 * ```ts
 * import { DisputeMethod } from '@yankikucuk/efatura'
 * import type { ObjectionRequestInput } from '@yankikucuk/efatura'
 *
 * const input: ObjectionRequestInput = {
 *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *   method: DisputeMethod.NOTARY,
 *   referenceDocumentId: '2026/1234',
 *   referenceDocumentDate: '05/09/2026',
 *   reason: 'Hizmet teslim edilmedi.',
 * }
 * console.log(input.method)
 * ```
 */
export interface ObjectionRequestInput {
  /** İtiraz edilen belgenin ETTN'i. Boş olamaz. */
  ettn: string
  /** Tebliğ yöntemi: NOTER, TAAHHUTLU_MEKTUP, TELGRAF veya KEP. */
  method: DisputeMethodCode
  /** İtiraz tebligatının belge numarası/sayısı. */
  referenceDocumentId: string
  /**
   * İtiraz tebligatının tarihi; `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`,
   * `yyyy-MM-dd` biçiminde metin. Boş metin kabul edilmez.
   */
  referenceDocumentDate: DateInput
  /** İtiraz gerekçesi; portal boş bırakılmasına izin vermez. */
  reason: string
  /** Varsayılan `Onaylandı`. */
  approvalStatus?: ApprovalStatusValue
  /** Belge türü; varsayılan `'FATURA'`. */
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
 *
 * @example
 * ```ts
 * import { DisputeMethod } from '@yankikucuk/efatura'
 * import type { IncomingObjectionRequestInput } from '@yankikucuk/efatura'
 *
 * const input: IncomingObjectionRequestInput = {
 *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *   invoiceOid: '4021',
 *   totalAmount: 1_200,
 *   sellerTaxOrIdentityNumber: '1111111111',
 *   documentNumber: 'EAR2026000000123',
 *   method: DisputeMethod.KEP,
 *   referenceDocumentId: '2026/1234',
 *   referenceDocumentDate: new Date(2026, 8, 5),
 *   reason: 'Sipariş edilmemiş hizmet faturalandı.',
 * }
 * console.log(input.invoiceOid, input.totalAmount)
 * ```
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

/**
 * `respondToDisputeRequest` girdisi — size gelen bir talebin cevabı.
 *
 * @example Kabul
 * ```ts
 * import { DisputeAnswer } from '@yankikucuk/efatura'
 * import type { DisputeResponseInput } from '@yankikucuk/efatura'
 *
 * const input: DisputeResponseInput = { disputeId: '1234', answer: DisputeAnswer.ACCEPT }
 * console.log(input.answer)
 * ```
 *
 * @example Ret — gerekçe ZORUNLU
 * ```ts
 * import { DisputeAnswer } from '@yankikucuk/efatura'
 * import type { DisputeResponseInput } from '@yankikucuk/efatura'
 *
 * const input: DisputeResponseInput = {
 *   disputeId: '1234',
 *   answer: DisputeAnswer.REJECT,
 *   rejectionReason: 'Belge doğru düzenlenmiştir.',
 * }
 * console.log(input.rejectionReason)
 * ```
 */
export interface DisputeResponseInput {
  /** Portal `iptalItirazOid` alanı. */
  disputeId: string
  /** `DisputeAnswer.ACCEPT` (`'1'`) veya `DisputeAnswer.REJECT` (`'2'`). */
  answer: DisputeAnswerValue
  /** Ret cevabında zorunlu. */
  rejectionReason?: string
  /** Belge türü; varsayılan `'FATURA'`. */
  documentType?: DocumentTypeCode
}

/**
 * Gelen iptal/itiraz talebi satırı.
 *
 * @example
 * ```ts
 * import { DisputeKind, DisputeStatus, EArsivClient } from '@yankikucuk/efatura'
 * import type { DisputeRequest } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const requests: DisputeRequest[] = await client.listDisputeRequests(new Date(), new Date())
 * const bekleyenItirazlar = requests.filter(
 *   (request) => request.kind === DisputeKind.OBJECTION && request.status === DisputeStatus.CREATED,
 * )
 * console.log(bekleyenItirazlar.length)
 * ```
 */
export interface DisputeRequest {
  /** Portal `iptalItirazOid` alanı; cevap verirken geri gönderilir. */
  disputeId: string
  /** Talebe konu belgenin numarası. */
  documentNumber: string
  /** Belge türü; portal vermezse `'FATURA'`. */
  documentType: DocumentTypeCode
  /** `0` iptal talebi, `1` itiraz talebi. */
  kind: DisputeKindValue
  /** `0` oluştu, `1` kabul, `2` ret, `3` iptal. */
  status: DisputeStatusValue
  /** Tebliğ yöntemi; yalnızca itiraz taleplerinde doludur, iptalde boş string. */
  method: DisputeMethodCode | ''
}
