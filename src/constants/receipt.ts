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
 *
 * @example Kalem oranlarını kütüphane alan adlarıyla vermek
 * ```ts
 * import { ProducerReceiptTax, Unit } from '@yankikucuk/efatura'
 * import type { ProducerReceiptLineItemInput } from '@yankikucuk/efatura'
 *
 * // `0003` kodunun kütüphanedeki adı `incomeTaxWithholding`.
 * console.log(ProducerReceiptTax.INCOME_TAX_WITHHOLDING)
 *
 * const item: ProducerReceiptLineItemInput = {
 *   name: 'Buğday',
 *   quantity: 100,
 *   unit: Unit.KILOGRAM,
 *   unitPrice: 12,
 *   taxRates: { incomeTaxWithholding: 2 },
 * }
 * console.log(item.taxRates?.incomeTaxWithholding)
 * ```
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

/**
 * {@link ProducerReceiptTax} sabitlerinden türetilen birleşim tipi — dört
 * portal vergi kodu.
 *
 * @example
 * ```ts
 * import { ProducerReceiptTax } from '@yankikucuk/efatura'
 * import type { ProducerReceiptTaxCode } from '@yankikucuk/efatura'
 *
 * const code: ProducerReceiptTaxCode = ProducerReceiptTax.PASTURE_FUND
 * console.log(code)
 * ```
 */
export type ProducerReceiptTaxCode = (typeof ProducerReceiptTax)[keyof typeof ProducerReceiptTax]

/**
 * Vergilerin belge üzerindeki sabit sırası; yük ve toplamlar bu sırayı izler.
 *
 * Sıra ANLAMLIDIR: portal yükünde kalem alanları ve belge toplamları bu
 * dizilimle üretilir.
 *
 * @example
 * ```ts
 * import { PRODUCER_RECEIPT_TAX_CODES } from '@yankikucuk/efatura'
 *
 * console.log(PRODUCER_RECEIPT_TAX_CODES) // ['0003', '9040', '8001', 'SGK_PRIM']
 * ```
 */
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
 *
 * @example Ham yanıttan belge düzeyi kesintiyi okumak
 * ```ts
 * import { EArsivClient, PRODUCER_RECEIPT_TAX_TOTAL_FIELDS, ProducerReceiptTax } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const detail = await client.getProducerReceipt('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * const field = PRODUCER_RECEIPT_TAX_TOTAL_FIELDS[ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM]
 * console.log(field) // 'hesaplananvSGK_PRIMTutari' — tek başına `Tutari` ekli
 * console.log(detail.raw[field])
 * ```
 */
export const PRODUCER_RECEIPT_TAX_TOTAL_FIELDS: Readonly<Record<ProducerReceiptTaxCode, string>> = {
  [ProducerReceiptTax.INCOME_TAX_WITHHOLDING]: 'hesaplananv0003',
  [ProducerReceiptTax.PASTURE_FUND]: 'hesaplananv9040',
  [ProducerReceiptTax.STOCK_EXCHANGE_REGISTRATION]: 'hesaplananv8001',
  [ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM]: 'hesaplananvSGK_PRIMTutari',
}
