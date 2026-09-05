import { EArsivError } from './base.error.js'

/**
 * Sonuç tekil olarak belirlenemedi. Yanlış değer döndürmektense hata
 * fırlatılır; adaylar çağıran tarafa iletilir.
 */
export class EArsivAmbiguousResultError<T = unknown> extends EArsivError {
  readonly kind = 'ambiguous-result'
  readonly candidates: readonly T[]

  constructor(message: string, candidates: readonly T[]) {
    super(message)
    this.candidates = candidates
  }
}
