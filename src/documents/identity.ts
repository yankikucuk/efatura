const DIGITS_ONLY = /^\d+$/

/**
 * VKN 10, TCKN 11 hanedir; portal yalnızca uzunluk ve rakam kontrolü yapar.
 *
 * `invoice.validator.ts`'ten buraya taşındı: fatura, müstahsil makbuzu ve
 * serbest meslek makbuzu üçü de aynı `vknTckn` alanını kullanıyor ve
 * kardeş modüller birbirini import edemiyor. `invoice` bu adı geriye dönük
 * uyumluluk için kendi yüzeyinden yeniden dışa açar.
 *
 * DİKKAT: bu bir UZUNLUK ve RAKAM kontrolüdür — TCKN'nin kendi sağlama
 * algoritmasını ya da VKN'nin kontrol basamağını DOĞRULAMAZ. Portal da
 * doğrulamaz; amaç, açıkça hatalı bir değerin ağa çıkmasını önlemektir.
 *
 * @param value Denetlenecek numara. Yalnızca rakamlardan oluşmalı; boşluk,
 *   tire veya başka bir karakter içeren değer geçersizdir (kırpma YAPILMAZ).
 * @returns 10 haneli (VKN) veya 11 haneli (TCKN) saf rakam ise `true`.
 *
 * @example
 * ```ts
 * import { isValidTaxOrIdentityNumber } from '@yankikucuk/efatura'
 *
 * console.log(isValidTaxOrIdentityNumber('1111111111')) // true — VKN
 * console.log(isValidTaxOrIdentityNumber('11111111111')) // true — TCKN
 * console.log(isValidTaxOrIdentityNumber('111 111 1111')) // false — boşluk
 * console.log(isValidTaxOrIdentityNumber('123')) // false — hane sayısı
 * ```
 */
export function isValidTaxOrIdentityNumber(value: string): boolean {
  return DIGITS_ONLY.test(value) && (value.length === 10 || value.length === 11)
}
