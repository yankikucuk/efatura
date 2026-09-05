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

/**
 * Gelen talep listesinin bir satırını eşler.
 *
 * @param raw `EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR` yanıtının
 *   bir satırı. Eksik alanlar güvenli varsayılanlara düşer: `belgeTuru` →
 *   `'FATURA'`, `iptalItiraz` → `'0'` (iptal), `iptalItirazDurumu` → `'0'`
 *   (oluştu), `itirazYontemi` → boş string.
 * @returns Eşlenmiş talep satırı.
 *
 * @example
 * ```ts
 * import { DisputeKind, toDisputeRequest } from '@yankikucuk/efatura'
 *
 * const request = toDisputeRequest({
 *   iptalItirazOid: '1234',
 *   belgeNumarasi: 'EAR2026000000123',
 *   iptalItiraz: '1',
 *   iptalItirazDurumu: '0',
 *   itirazYontemi: 'KEP',
 * })
 * console.log(request.kind === DisputeKind.OBJECTION, request.method)
 * ```
 */
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
