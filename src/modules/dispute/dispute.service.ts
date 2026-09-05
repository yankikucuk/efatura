import { ApprovalStatus, Command, DocumentType, PageName } from '../../constants/index.js'
import { type DateInput, formatMinor, formatPortalDate, toMinor } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { toDisputeRequest } from './dispute.mapper.js'
import type {
  CancellationRequestInput,
  DisputeRequest,
  DisputeResponseInput,
  IncomingObjectionRequestInput,
  ObjectionRequestInput,
} from './dispute.types.js'
import {
  validateCancellationRequest,
  validateDisputeResponse,
  validateIncomingObjectionRequest,
  validateObjectionRequest,
} from './dispute.validator.js'

const asRows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : []

/**
 * İptal ve itiraz talepleri.
 *
 * Talep yalnızca ONAYLANMIŞ bir belge için ve belge başına bir kez
 * açılabilir; koşul sağlanmazsa portal iş kuralı hatası döndürür ve bu
 * `EArsivApiError` olarak yükselir (spec §9.2).
 */
export class DisputeService {
  constructor(private readonly gateway: DispatchGateway) {}

  /** Kendi kestiğiniz bir belge için iptal talebi açar. */
  async createCancellationRequest(input: CancellationRequestInput): Promise<string> {
    validateCancellationRequest(input)
    return this.gateway.call<string>(Command.CREATE_CANCELLATION_REQUEST, PageName.DRAFTS, {
      ettn: input.ettn,
      onayDurumu: input.approvalStatus ?? ApprovalStatus.APPROVED,
      belgeTuru: input.documentType ?? DocumentType.INVOICE,
      talepAciklama: input.reason,
    })
  }

  /**
   * Kendi düzenlediğiniz bir belgeye itiraz talebi açar (yedi alanlı yük,
   * `RG_TASLAKLAR`). Adınıza düzenlenmiş bir belgeye itiraz için
   * `createObjectionRequestForIncoming` kullanın — portal bu iki durum için
   * FARKLI yükler bekler (bkz. rapor, Fix 2).
   */
  async createObjectionRequest(input: ObjectionRequestInput): Promise<string> {
    validateObjectionRequest(input)
    return this.gateway.call<string>(Command.CREATE_OBJECTION_REQUEST, PageName.DRAFTS, {
      ettn: input.ettn,
      onayDurumu: input.approvalStatus ?? ApprovalStatus.APPROVED,
      belgeTuru: input.documentType ?? DocumentType.INVOICE,
      itirazYontemi: input.method,
      referansBelgeId: input.referenceDocumentId,
      referansBelgeTarihi: formatPortalDate(input.referenceDocumentDate),
      talepAciklama: input.reason,
    })
  }

  /**
   * Adınıza düzenlenmiş (portal veya entegratör) bir belgeye itiraz talebi
   * açar — spec §9.2'nin belgelediği asıl kullanım durumu. On bir alanlı yük
   * ve `RG_ALICI_TASLAKLAR` sayfa adı gönderir; `createObjectionRequest`'in
   * yedi alanlı, `RG_TASLAKLAR` sayfa adlı yüküyle KARIŞTIRILMAMALIDIR.
   */
  async createObjectionRequestForIncoming(input: IncomingObjectionRequestInput): Promise<string> {
    validateIncomingObjectionRequest(input)
    return this.gateway.call<string>(Command.CREATE_OBJECTION_REQUEST, PageName.INCOMING_DRAFTS, {
      ettn: input.ettn,
      faturaOid: input.invoiceOid,
      toplamTutar: formatMinor(toMinor(input.totalAmount)),
      saticiVknTckn: input.sellerTaxOrIdentityNumber,
      belgeNumarasi: input.documentNumber,
      onayDurumu: input.approvalStatus ?? ApprovalStatus.APPROVED,
      belgeTuru: input.documentType ?? DocumentType.INVOICE,
      itirazYontemi: input.method,
      referansBelgeId: input.referenceDocumentId,
      referansBelgeTarihi: formatPortalDate(input.referenceDocumentDate),
      talepAciklama: input.reason,
    })
  }

  /** Size gelen iptal/itiraz taleplerini listeler. */
  async listRequests(from: DateInput, to: DateInput): Promise<DisputeRequest[]> {
    const data = await this.gateway.call<unknown>(
      Command.LIST_DISPUTE_REQUESTS,
      PageName.DISPUTE_DRAFTS,
      { baslangic: formatPortalDate(from), bitis: formatPortalDate(to) },
    )
    return asRows(data).map(toDisputeRequest)
  }

  /** Gelen bir talebi kabul eder veya gerekçeyle reddeder. */
  async respondToRequest(input: DisputeResponseInput): Promise<string> {
    validateDisputeResponse(input)
    return this.gateway.call<string>(Command.RESPOND_TO_DISPUTE, PageName.DISPUTE_DRAFTS, {
      iptalItirazOid: input.disputeId,
      talepCevabi: input.answer,
      belgeTuru: input.documentType ?? DocumentType.INVOICE,
      retAciklama: input.rejectionReason ?? '',
    })
  }
}
