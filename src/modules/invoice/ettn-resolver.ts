import { EArsivAmbiguousResultError } from '../../core/index.js'

import type { InvoiceSummary } from './invoice.types.js'

export interface EttnResolveHint {
  buyerTaxOrIdentityNumber: string
  buyerName: string
  /** `dd/MM/yyyy` biçiminde belge tarihi. */
  date: string
}

export interface EttnResolveContext {
  /** Oluşturmadan önceki taslakların ETTN kümesi. */
  before: ReadonlySet<string>
  /** Oluşturmadan sonraki tam taslak listesi. */
  after: readonly InvoiceSummary[]
  hint: EttnResolveHint
}

const AMBIGUOUS_ADVICE =
  'Fatura oluşturuldu ancak ETTN tekil olarak belirlenemedi. ' +
  'Yanlış ETTN döndürmemek için işlem durduruldu; adaylar hatanın candidates alanındadır. ' +
  'Doğru kaydı listeden seçebilirsiniz.'

/**
 * Oluşturulan faturanın ETTN'ini anlık görüntü farkıyla bulur.
 *
 * Portal `EARSIV_PORTAL_FATURA_OLUSTUR` yanıtında ETTN döndürmüyor
 * (spec §2.3, §6). Fark tekile inmezse tahmin yerine hata fırlatılır.
 */
export function resolveCreatedEttn(context: EttnResolveContext): InvoiceSummary {
  const created = context.after.filter((row) => !context.before.has(row.ettn))

  if (created.length === 1) {
    const [only] = created
    if (only !== undefined) return only
  }

  if (created.length === 0) {
    throw new EArsivAmbiguousResultError<InvoiceSummary>(
      `${AMBIGUOUS_ADVICE} Listede yeni kayıt bulunamadı; portal listeyi gecikmeli güncelliyor olabilir.`,
      context.after,
    )
  }

  const { hint } = context
  const narrowed = created.filter(
    (row) =>
      row.buyerTaxOrIdentityNumber === hint.buyerTaxOrIdentityNumber &&
      row.date === hint.date &&
      // Portal TCKN'li alıcılarda ünvan alanını boş bırakabiliyor; boşsa
      // ayırt edici değildir ve eşleşme sayılır.
      (row.buyerName === '' || hint.buyerName === '' || row.buyerName === hint.buyerName),
  )

  if (narrowed.length === 1) {
    const [only] = narrowed
    if (only !== undefined) return only
  }

  throw new EArsivAmbiguousResultError<InvoiceSummary>(
    `${AMBIGUOUS_ADVICE} ${String(created.length)} yeni kayıt bulundu.`,
    created,
  )
}
