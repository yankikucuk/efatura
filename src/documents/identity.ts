const DIGITS_ONLY = /^\d+$/

/**
 * VKN 10, TCKN 11 hanedir; portal yalnızca uzunluk ve rakam kontrolü yapar.
 *
 * `invoice.validator.ts`'ten buraya taşındı: fatura, müstahsil makbuzu ve
 * serbest meslek makbuzu üçü de aynı `vknTckn` alanını kullanıyor ve
 * kardeş modüller birbirini import edemiyor. `invoice` bu adı geriye dönük
 * uyumluluk için kendi yüzeyinden yeniden dışa açar.
 */
export function isValidTaxOrIdentityNumber(value: string): boolean {
  return DIGITS_ONLY.test(value) && (value.length === 10 || value.length === 11)
}
