/**
 * Kütüphanenin fırlattığı tüm hataların ortak tabanı.
 *
 * Bu kütüphaneden çıkan HER hata `EArsivError`'dan türer; `instanceof
 * EArsivError` kontrolü, hatanın bu kütüphaneden mi yoksa çağıranın kendi
 * kodundan mı geldiğini ayırmanın güvenilir yoludur. Alt sınıflar
 * makine tarafından ayırt edilebilir bir `kind` etiketi taşır:
 * `'api'`, `'auth'`, `'validation'`, `'ambiguous-result'`, `'network'`,
 * `'portal-defect'`.
 *
 * `name` özelliği her zaman gerçek alt sınıfın adıdır (ör.
 * `'EArsivApiError'`), çünkü kurucu `new.target.name` kullanır.
 *
 * @example Kütüphane hatalarını diğerlerinden ayırmak
 * ```ts
 * import { EArsivClient, EArsivError } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 *
 * try {
 *   await client.getUserInfo()
 * } catch (error) {
 *   if (error instanceof EArsivError) {
 *     console.error(`[${error.kind}] ${error.name}: ${error.message}`)
 *   } else {
 *     throw error
 *   }
 * }
 * ```
 */
export abstract class EArsivError extends Error {
  /**
   * Hatanın makine tarafından ayırt edilebilir türü. Her alt sınıf sabit bir
   * dize atar; `switch` ile dallanmak için `instanceof`'a alternatiftir.
   */
  abstract readonly kind: string

  /**
   * @param message İnsan tarafından okunabilir hata metni. Kütüphane bu metni
   *   her zaman KENDİ KENDİNE YETERLİ yazar: yalnızca `error.message`
   *   günlüğe basan bir çağıran da neyin yanlış olduğunu görür.
   * @param options `cause` verilirse kök neden zinciri korunur ve standart
   *   `Error.cause` üzerinden okunabilir.
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }
}
