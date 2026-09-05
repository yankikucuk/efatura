/**
 * Müstahsil makbuzunda kesilen dört vergi/kesinti. Kodlar portal alan
 * adlarının KAYNAĞIDIR: kalem düzeyinde `v<kod>Orani` / `v<kod>Tutari`
 * çiftleri olarak gönderilir (ör. `v0003Orani`, `vSGK_PRIMTutari`).
 *
 * Belge düzeyindeki toplamlar okuma yanıtında ASİMETRİK adlarla döner:
 * `hesaplananv0003`, `hesaplananv9040`, `hesaplananv8001` — ama dördüncüsü
 * `hesaplananvSGK_PRIMTutari`, yani tek başına `Tutari` ekiyle biter. Bu bir
 * yazım hatası değil, portalın kendi yanıtıdır (canlı doğrulandı 2026-09-05);
 * bkz. `PRODUCER_RECEIPT_TAX_TOTAL_FIELDS`.
 */
export const ProducerReceiptTax = {
  /** Gelir Vergisi Stopajı. */
  INCOME_TAX_WITHHOLDING: '0003',
  /** Mera Fonu. */
  PASTURE_FUND: '9040',
  /** Borsa Tescil Ücreti. */
  STOCK_EXCHANGE_REGISTRATION: '8001',
  /** SGK Prim Kesintisi. */
  SOCIAL_SECURITY_PREMIUM: 'SGK_PRIM',
} as const

export type ProducerReceiptTaxCode = (typeof ProducerReceiptTax)[keyof typeof ProducerReceiptTax]

/** Vergilerin belge üzerindeki sabit sırası; yük ve toplamlar bu sırayı izler. */
export const PRODUCER_RECEIPT_TAX_CODES: readonly ProducerReceiptTaxCode[] = [
  ProducerReceiptTax.INCOME_TAX_WITHHOLDING,
  ProducerReceiptTax.PASTURE_FUND,
  ProducerReceiptTax.STOCK_EXCHANGE_REGISTRATION,
  ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM,
]

/**
 * Belge düzeyindeki vergi toplamlarının portal alan adları.
 *
 * Türetilebilir DEĞİLDİR: `SGK_PRIM` girdisi diğer üçünden farklı olarak
 * `Tutari` ekiyle biter. Bir döngüde `hesaplananv${kod}` üretmek bu alanı
 * sessizce kaçırırdı.
 */
export const PRODUCER_RECEIPT_TAX_TOTAL_FIELDS: Readonly<Record<ProducerReceiptTaxCode, string>> = {
  [ProducerReceiptTax.INCOME_TAX_WITHHOLDING]: 'hesaplananv0003',
  [ProducerReceiptTax.PASTURE_FUND]: 'hesaplananv9040',
  [ProducerReceiptTax.STOCK_EXCHANGE_REGISTRATION]: 'hesaplananv8001',
  [ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM]: 'hesaplananvSGK_PRIMTutari',
}
