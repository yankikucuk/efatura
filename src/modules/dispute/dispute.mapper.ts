import {
  DisputeKind,
  type DisputeKindValue,
  type DisputeMethodCode,
  DisputeStatus,
  type DisputeStatusValue,
  DocumentType,
  type DocumentTypeCode,
} from '../../constants/index.js'

import type { DisputeRequest } from './dispute.types.js'

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

/** Gelen talep listesinin bir satırını eşler. */
export function toDisputeRequest(raw: Record<string, unknown>): DisputeRequest {
  return {
    disputeId: str(raw.iptalItirazOid),
    documentNumber: str(raw.belgeNumarasi),
    documentType: str(raw.belgeTuru, DocumentType.INVOICE) as DocumentTypeCode,
    kind: str(raw.iptalItiraz, DisputeKind.CANCELLATION) as DisputeKindValue,
    status: str(raw.iptalItirazDurumu, DisputeStatus.CREATED) as DisputeStatusValue,
    method: str(raw.itirazYontemi) as DisputeMethodCode | '',
  }
}
