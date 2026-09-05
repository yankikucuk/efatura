import { EArsivAmbiguousResultError } from '../core/index.js'

import type { DocumentSummary } from './document.types.js'

/**
 * Fark birden fazla kayıt verdiğinde daraltmak için kullanılan ipucu.
 *
 * Üç alanın üçü de yeni kayıtlarla karşılaştırılır; `buyerName` alanı iki
 * taraftan biri BOŞSA ayırt edici sayılmaz (portal TCKN'li alıcılarda ve
 * müstahsil makbuzlarında bu alanı boş bırakabiliyor).
 *
 * @example
 * ```ts
 * import type { EttnResolveHint } from '@yankikucuk/efatura'
 *
 * const hint: EttnResolveHint = {
 *   buyerTaxOrIdentityNumber: '11111111111',
 *   buyerName: 'Ali Yılmaz',
 *   date: '05/09/2026',
 * }
 * console.log(hint.date)
 * ```
 */
export interface EttnResolveHint {
  /** Belgenin alıcısının VKN/TCKN'i; liste satırıyla birebir karşılaştırılır. */
  buyerTaxOrIdentityNumber: string
  /** Alıcının ünvanı ya da ad+soyadı. Boşsa daraltmada KULLANILMAZ. */
  buyerName: string
  /** `dd/MM/yyyy` biçiminde belge tarihi. */
  date: string
}

/**
 * `resolveCreatedEttn` girdisi — oluşturmanın iki yanındaki anlık görüntüler.
 *
 * @example
 * ```ts
 * import type { EttnResolveContext } from '@yankikucuk/efatura'
 *
 * const context: EttnResolveContext = {
 *   before: new Set(['eski-ettn']),
 *   after: [],
 *   hint: { buyerTaxOrIdentityNumber: '11111111111', buyerName: '', date: '05/09/2026' },
 * }
 * console.log(context.before.size)
 * ```
 */
export interface EttnResolveContext {
  /** Oluşturmadan önceki taslakların ETTN kümesi. */
  before: ReadonlySet<string>
  /** Oluşturmadan sonraki tam taslak listesi. */
  after: readonly DocumentSummary[]
  /** Fark tekile inmezse daraltmada kullanılacak ipucu. */
  hint: EttnResolveHint
}

const AMBIGUOUS_ADVICE =
  'Belge oluşturuldu ancak ETTN tekil olarak belirlenemedi. ' +
  'Yanlış ETTN döndürmemek için işlem durduruldu; adaylar hatanın candidates alanındadır. ' +
  'Doğru kaydı listeden seçebilirsiniz.'

/**
 * Oluşturulan faturanın ETTN'ini anlık görüntü farkıyla bulur.
 *
 * Portal `EARSIV_PORTAL_FATURA_OLUSTUR` yanıtında ETTN döndürmüyor
 * (spec §2.3, §6). Fark tekile inmezse tahmin yerine hata fırlatılır.
 *
 * Aynı mantık her iki makbuz türü için de kullanılır: portal makbuzlarda da
 * ETTN'i kendisi atar ve istemcinin gönderdiğini yok sayar.
 *
 * @param context Oluşturmadan önceki ETTN kümesi, sonraki tam liste ve
 *   daraltma ipucu.
 * @returns Yeni oluşturulan belgenin özet satırı.
 * @throws {EArsivAmbiguousResultError} Fark BOŞSA (portal listeyi gecikmeli
 *   güncelliyor olabilir — `candidates` oluşturmadan sonraki TAM listedir) ya
 *   da ipucuyla daraltıldıktan sonra hâlâ birden fazla aday varsa
 *   (`candidates` yalnızca yeni kayıtlardır). Her iki durumda da belge
 *   portalda BÜYÜK OLASILIKLA OLUŞMUŞTUR.
 *
 * @example
 * ```ts
 * import { resolveCreatedEttn } from '@yankikucuk/efatura'
 * import type { InvoiceSummary } from '@yankikucuk/efatura'
 *
 * const after: InvoiceSummary[] = [
 *   {
 *     ettn: 'yeni-ettn',
 *     documentNumber: 'EAR2026000000123',
 *     buyerTaxOrIdentityNumber: '11111111111',
 *     buyerName: 'Ali Yılmaz',
 *     date: '05/09/2026',
 *     documentType: 'FATURA',
 *     approvalStatus: 'Onaylanmadı',
 *   },
 * ]
 * const created = resolveCreatedEttn({
 *   before: new Set(['eski-ettn']),
 *   after,
 *   hint: { buyerTaxOrIdentityNumber: '11111111111', buyerName: 'Ali Yılmaz', date: '05/09/2026' },
 * })
 * console.log(created.ettn) // 'yeni-ettn'
 * ```
 */
export function resolveCreatedEttn(context: EttnResolveContext): DocumentSummary {
  const created = context.after.filter((row) => !context.before.has(row.ettn))

  if (created.length === 1) {
    const [only] = created
    if (only !== undefined) return only
  }

  if (created.length === 0) {
    throw new EArsivAmbiguousResultError<DocumentSummary>(
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

  throw new EArsivAmbiguousResultError<DocumentSummary>(
    `${AMBIGUOUS_ADVICE} ${String(created.length)} yeni kayıt bulundu.`,
    created,
  )
}
