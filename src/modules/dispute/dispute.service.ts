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
 *
 * Test ortamındaki taslaklar onaysız olduğu için oluşturma çağrıları orada
 * beklenen şekilde iş kuralı hatası verir; akışın kendisi doğrudur.
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   DisputeService,
 *   HttpClient,
 *   resolveClientOptions,
 * } from 'efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const disputes = new DisputeService(new DispatchGateway(http, auth))
 * console.log((await disputes.listRequests(new Date(), new Date())).length)
 * ```
 */
export class DisputeService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * Kendi kestiğiniz bir belge için iptal talebi açar.
   *
   * @param input `ettn` ve `reason` zorunludur; `approvalStatus` varsayılan
   *   `'Onaylandı'`, `documentType` varsayılan `'FATURA'`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} `ettn` veya `reason` boşsa — ağa hiç
   *   çıkılmaz.
   * @throws {EArsivApiError} Belge onaysızsa, talep zaten açılmışsa veya
   *   portal reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * console.log(
   *   await client.createCancellationRequest({
   *     ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *     reason: 'Fatura yanlış mükellefe düzenlendi.',
   *   }),
   * )
   * ```
   */
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
   *
   * @param input `ettn`, `method`, `referenceDocumentId`,
   *   `referenceDocumentDate` ve `reason` zorunludur; `approvalStatus`
   *   varsayılan `'Onaylandı'`, `documentType` varsayılan `'FATURA'`.
   *   `referenceDocumentDate` bir `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`,
   *   `yyyy-MM-dd` metni olabilir.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} Zorunlu metin alanlarından biri boşsa
   *   ya da tarih biçimi tanınmazsa.
   * @throws {EArsivApiError} Portal iş kuralıyla reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeMethod, EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * console.log(
   *   await client.createObjectionRequest({
   *     ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *     method: DisputeMethod.REGISTERED_MAIL,
   *     referenceDocumentId: '2026/1234',
   *     referenceDocumentDate: '05/09/2026',
   *     reason: 'Hizmet teslim edilmedi.',
   *   }),
   * )
   * ```
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
   *
   * @param input `ObjectionRequestInput`'un tüm alanlarına EK OLARAK dördü
   *   birlikte zorunludur: `invoiceOid` (belgenin portal içi kaydı),
   *   `totalAmount` (belgenin toplam tutarı, LİRA), `sellerTaxOrIdentityNumber`
   *   (belgeyi düzenleyen satıcının VKN/TCKN'i) ve `documentNumber`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} Ortak yedi alandan biri ya da dört ek
   *   alandan biri boş/geçersizse (`totalAmount` sonlu ve negatif olmayan bir
   *   sayı olmalıdır).
   * @throws {EArsivApiError} Portal iş kuralıyla reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeMethod, EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * console.log(
   *   await client.createObjectionRequestForIncoming({
   *     ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *     invoiceOid: '4021',
   *     totalAmount: 1_200,
   *     sellerTaxOrIdentityNumber: '1111111111',
   *     documentNumber: 'EAR2026000000123',
   *     method: DisputeMethod.KEP,
   *     referenceDocumentId: '2026/1234',
   *     referenceDocumentDate: '05/09/2026',
   *     reason: 'Sipariş edilmemiş hizmet faturalandı.',
   *   }),
   * )
   * ```
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

  /**
   * Size gelen iptal/itiraz taleplerini listeler.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Talep satırları; kayıt yoksa boş dizi. Portal dizi yerine bir
   *   hata metni döndürürse de boş dizi döner.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * for (const request of await client.listDisputeRequests('01/09/2026', '30/09/2026')) {
   *   console.log(request.disputeId, request.kind, request.status)
   * }
   * ```
   */
  async listRequests(from: DateInput, to: DateInput): Promise<DisputeRequest[]> {
    const data = await this.gateway.call<unknown>(
      Command.LIST_DISPUTE_REQUESTS,
      PageName.DISPUTE_DRAFTS,
      { baslangic: formatPortalDate(from), bitis: formatPortalDate(to) },
    )
    return asRows(data).map(toDisputeRequest)
  }

  /**
   * Gelen bir talebi kabul eder veya gerekçeyle reddeder.
   *
   * @param input `disputeId` liste satırındaki talep kimliği; `answer`
   *   `DisputeAnswer.ACCEPT` (`'1'`) ya da `DisputeAnswer.REJECT` (`'2'`);
   *   `rejectionReason` YALNIZCA ret cevabında zorunludur; `documentType`
   *   varsayılan `'FATURA'`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} `disputeId` boşsa veya ret cevabında
   *   gerekçe verilmemişse — ağa hiç çıkılmaz.
   * @throws {EArsivApiError} Portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeAnswer, EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * console.log(
   *   await client.respondToDisputeRequest({
   *     disputeId: '1234',
   *     answer: DisputeAnswer.REJECT,
   *     rejectionReason: 'Belge doğru düzenlenmiştir.',
   *   }),
   * )
   * ```
   */
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
