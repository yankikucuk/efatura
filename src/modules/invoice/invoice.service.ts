import {
  Command,
  DocumentType,
  InvoiceListKind,
  type InvoiceListKindValue,
  PageName,
} from '../../constants/index.js'
import { type DateInput, EArsivValidationError, formatPortalDate } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { resolveCreatedEttn } from './ettn-resolver.js'
import { fromPortalPayload, toInvoiceSummary, toPortalInvoice } from './invoice.mapper.js'
import { computeTotals, mergeAndVerifyTotals } from './invoice.totals.js'
import type {
  CreatedInvoice,
  InvoiceDetail,
  InvoiceInput,
  InvoiceSummary,
  ListOptions,
} from './invoice.types.js'
import { validateInvoiceInput } from './invoice.validator.js'

const asRows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : []

/** Fatura oluşturma, listeleme, okuma ve silme işlemleri. */
export class InvoiceService {
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * Taslak fatura oluşturur ve atanan ETTN'i çözer.
   *
   * Portal ETTN'i yanıtta döndürmediği için (spec §2.3) oluşturmadan önce ve
   * sonra taslak listesi alınır ve fark hesaplanır. Fark tekile inmezse
   * `EArsivAmbiguousResultError` fırlatılır — yanlış ETTN dönmek yerine.
   */
  async createDraft(input: InvoiceInput): Promise<CreatedInvoice> {
    validateInvoiceInput(input)
    // Tutarsız `totals` override'ı ağa çıkmadan yakalansın: toplamlar
    // hesaplanır ve override eşitliklere karşı doğrulanır. toPortalInvoice
    // aynı hesabı tekrar yapar; bu ucuz ve saf bir işlem.
    mergeAndVerifyTotals(computeTotals(input.lineItems).totals, input.totals)

    const date = formatPortalDate(input.date)
    const before = new Set((await this.listDrafts(date, date)).map((row) => row.ettn))

    await this.gateway.call<string>(
      Command.CREATE_INVOICE,
      PageName.INVOICE_FORM,
      toPortalInvoice(input),
    )

    const after = await this.listDrafts(date, date)
    const created = resolveCreatedEttn({
      before,
      after,
      hint: {
        buyerTaxOrIdentityNumber: input.buyer.taxOrIdentityNumber,
        buyerName:
          input.buyer.title ??
          `${input.buyer.firstName ?? ''} ${input.buyer.lastName ?? ''}`.trim(),
        date,
      },
    })

    return {
      ettn: created.ettn,
      documentNumber: created.documentNumber,
      date: created.date,
      approvalStatus: created.approvalStatus,
    }
  }

  /** Belirtilen tarih aralığındaki düzenlenen belgeleri listeler. */
  async listDrafts(
    from: DateInput,
    to: DateInput,
    options: ListOptions = {},
  ): Promise<InvoiceSummary[]> {
    const kind: InvoiceListKindValue = options.kind ?? InvoiceListKind.INTERACTIVE
    const data = await this.gateway.call<unknown>(
      Command.LIST_INVOICES,
      kind === InvoiceListKind.STANDARD ? PageName.DRAFTS : PageName.INTERACTIVE_DRAFTS,
      { baslangic: formatPortalDate(from), bitis: formatPortalDate(to), hangiTip: kind },
    )
    return asRows(data).map(toInvoiceSummary)
  }

  /** Adına düzenlenen belgeleri listeler. */
  async listIncoming(from: DateInput, to: DateInput): Promise<InvoiceSummary[]> {
    const data = await this.gateway.call<unknown>(Command.LIST_INCOMING, PageName.INCOMING_DRAFTS, {
      baslangic: formatPortalDate(from),
      bitis: formatPortalDate(to),
    })
    return asRows(data).map(toInvoiceSummary)
  }

  /** Tek bir faturanın tam detayını getirir. */
  async getInvoice(ettn: string): Promise<InvoiceDetail> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_INVOICE,
      PageName.INVOICE_FORM,
      { ettn },
    )
    const input = fromPortalPayload(raw)
    const { lines, totals } =
      input.lineItems.length > 0
        ? computeTotals(input.lineItems)
        : {
            lines: [],
            totals: {
              lineTotal: 0,
              totalDiscount: 0,
              taxBase: 0,
              calculatedVat: 0,
              additionalTaxes: 0,
              totalTaxes: 0,
              grandTotal: 0,
              payableAmount: 0,
            },
          }

    return {
      ettn,
      documentNumber: input.documentNumber ?? '',
      date: formatPortalDate(input.date),
      time: typeof input.time === 'string' ? input.time : '',
      currency: input.currency ?? 'TRY',
      currencyRate: input.currencyRate ?? 0,
      invoiceType: input.invoiceType ?? 'SATIS',
      buyer: input.buyer,
      lineItems: lines,
      totals,
      note: input.note ?? '',
      raw,
    }
  }

  /**
   * Onaylanmamış bir taslağı siler. Portal özet satırının tamamını istediği
   * için önce liste üzerinden ilgili kayıt bulunur.
   */
  async cancelDraft(ettn: string, reason = 'Yanlış İşlem'): Promise<void> {
    const today = formatPortalDate()
    const candidates = await this.listDrafts(today, today)
    const target = candidates.find((row) => row.ettn === ettn)

    if (target === undefined) {
      throw new EArsivValidationError(
        `Silinecek taslak bugünün listesinde bulunamadı: ${ettn}. ` +
          'Fatura başka bir tarihte oluşturulmuş olabilir.',
        [{ path: 'ettn', message: `Bulunamayan ETTN: ${ettn}` }],
      )
    }

    await this.gateway.call<string>(Command.DELETE_INVOICE, PageName.INTERACTIVE_DRAFTS, {
      silinecekler: [
        {
          belgeNumarasi: target.documentNumber,
          aliciVknTckn: target.buyerTaxOrIdentityNumber,
          aliciUnvanAdSoyad: target.buyerName,
          belgeTarihi: target.date,
          belgeTuru: DocumentType.INVOICE,
          ettn: target.ettn,
        },
      ],
      aciklama: reason,
    })
  }
}
