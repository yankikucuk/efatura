import { EArsivError } from './base.error.js'

/**
 * Sonuç tekil olarak belirlenemedi. Yanlış değer döndürmektense hata
 * fırlatılır; adaylar çağıran tarafa iletilir.
 *
 * Pratikte tek bir yerde çıkar: belge oluşturma. Portal oluşturma yanıtında
 * ETTN döndürmediği için kimlik, oluşturmadan önceki ve sonraki taslak
 * listelerinin farkından bulunur. Fark tekile inmezse — hiç yeni kayıt yok
 * ya da birden fazla var — bu hata fırlatılır.
 *
 * KRİTİK: bu hata "belge oluşmadı" DEMEK DEĞİLDİR. Belge portalda büyük
 * olasılıkla OLUŞMUŞTUR; yalnızca hangisi olduğu tekil olarak seçilememiştir.
 * Doğru tepki yeniden oluşturmak değil, `candidates` içinden doğru kaydı
 * seçmek ya da listeyi elle incelemektir.
 *
 * @typeParam T Aday kayıtların tipi; belge oluşturmada `InvoiceSummary`
 *   (yani `DocumentSummary`) olur.
 *
 * @example Adayları kendi ipucunuzla daraltmak
 * ```ts
 * import { EArsivAmbiguousResultError, EArsivClient, Unit } from '@yankikucuk/efatura'
 * import type { InvoiceSummary } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * try {
 *   await client.createDraft({
 *     documentNumber: 'EAR2026000000123',
 *     buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *     lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 *   })
 * } catch (error) {
 *   if (!(error instanceof EArsivAmbiguousResultError)) throw error
 *   // Belge OLUŞTU; yalnızca ETTN'i seçilemedi — yeniden oluşturmayın.
 *   const candidates = error.candidates as readonly InvoiceSummary[]
 *   const mine = candidates.find((row) => row.documentNumber === 'EAR2026000000123')
 *   console.log('Bulunan ETTN:', mine?.ettn)
 * }
 * ```
 */
export class EArsivAmbiguousResultError<T = unknown> extends EArsivError {
  /** Her zaman `'ambiguous-result'`. */
  readonly kind = 'ambiguous-result'
  /**
   * Sonucu tekilleştirmek için kullanılabilecek adaylar. Yeni kayıt hiç
   * bulunamadıysa oluşturmadan SONRAKİ tam liste, birden fazla bulunduysa
   * yalnızca yeni kayıtlar verilir.
   */
  readonly candidates: readonly T[]

  /**
   * @param message Hata metni; ne yapılması gerektiğini de söyler.
   * @param candidates Çağıranın seçebileceği adaylar; boş da olabilir.
   */
  constructor(message: string, candidates: readonly T[]) {
    super(message)
    this.candidates = candidates
  }
}
