import {
  PRODUCER_RECEIPT_TAX_CODES,
  ProducerReceiptTax,
  type ProducerReceiptTaxCode,
} from '../../constants/index.js'
import {
  applyPercent,
  EArsivValidationError,
  fromMinor,
  sumMinor,
  toMinor,
} from '../../core/index.js'

import type {
  ComputedProducerReceiptLineItem,
  ProducerReceiptLineItemInput,
  ProducerReceiptTaxAmounts,
  ProducerReceiptTaxRates,
  ProducerReceiptTotals,
} from './producer-receipt.types.js'

/**
 * Portal vergi kodu → kütüphane alan adı.
 *
 * Kodlar `constants` katmanında (portal gerçeği), İngilizce alan adları
 * burada (kütüphane sözleşmesi). İkisini ayrı tutmak, portal bir kod
 * eklerse alan adının bizim seçimimiz olarak kalmasını sağlar.
 *
 * DAHİLİ tablo: paket kökünden dışa açılmaz.
 *
 * @example Girdi ve çıktı
 * ```text
 * PRODUCER_RECEIPT_TAX_KEYS['0003']     -> 'incomeTaxWithholding'
 * PRODUCER_RECEIPT_TAX_KEYS['SGK_PRIM'] -> 'socialSecurityPremium'
 * ```
 */
export const PRODUCER_RECEIPT_TAX_KEYS: Readonly<
  Record<ProducerReceiptTaxCode, keyof ProducerReceiptTaxRates>
> = {
  [ProducerReceiptTax.INCOME_TAX_WITHHOLDING]: 'incomeTaxWithholding',
  [ProducerReceiptTax.PASTURE_FUND]: 'pastureFund',
  [ProducerReceiptTax.STOCK_EXCHANGE_REGISTRATION]: 'stockExchangeRegistration',
  [ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM]: 'socialSecurityPremium',
}

/**
 * Dört alanı da sıfırla açan boş bir kesinti tablosu.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz. Her çağrıda YENİ bir nesne
 * döner — paylaşılan bir sabit değildir, çünkü çağıranlar üzerine yazar.
 *
 * @example Girdi ve çıktı
 * ```text
 * emptyTaxAmounts() -> {
 *   incomeTaxWithholding: 0, pastureFund: 0,
 *   stockExchangeRegistration: 0, socialSecurityPremium: 0
 * }
 * ```
 */
export const emptyTaxAmounts = (): ProducerReceiptTaxAmounts => ({
  incomeTaxWithholding: 0,
  pastureFund: 0,
  stockExchangeRegistration: 0,
  socialSecurityPremium: 0,
})

const fail = (message: string, path: string): never => {
  throw new EArsivValidationError(message, [{ path, message }])
}

/**
 * Tek bir kalemin tutarını ve dört kesintiyi hesaplar.
 *
 * Tüm ara adımlar tam sayı kuruş üzerinden yapılır; her kesinti kalem
 * tutarının (miktar × birim fiyat) yüzdesidir ve AYRI AYRI yuvarlanır —
 * portal da kalem düzeyinde her kesintiyi ayrı bir alanda taşıdığı için
 * toplamdan geri hesaplamak bir kuruş sapma yaratabilirdi.
 *
 * @param item Hesaplanacak kalem; `name`, `quantity`, `unit` ve `unitPrice`
 *   zorunludur. `taxRates` verilmezse dört kesinti de 0 kabul edilir.
 * @param index Kalemin belge içindeki sırası; YALNIZCA hata mesajlarındaki
 *   yol için kullanılır. Varsayılan 0.
 * @returns Girdi alanlarının tamamını, kalem tutarını, dört kesinti tutarını
 *   ve bunların toplamını taşıyan kalem.
 * @throws {EArsivValidationError} `name` boşsa, `quantity` pozitif değilse,
 *   `unitPrice` negatifse ya da bir kesinti oranı [0, 100] dışındaysa.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptLineItem, Unit } from 'efatura'
 *
 * const line = computeProducerReceiptLineItem({
 *   name: 'Buğday',
 *   quantity: 100,
 *   unit: Unit.KILOGRAM,
 *   unitPrice: 12,
 *   taxRates: { incomeTaxWithholding: 2, pastureFund: 1 },
 * })
 * // 1200 tutar, 24 stopaj, 12 mera fonu, 36 toplam kesinti.
 * console.log(line.amount, line.taxAmounts.incomeTaxWithholding, line.totalTaxes)
 * ```
 */
export function computeProducerReceiptLineItem(
  item: ProducerReceiptLineItemInput,
  index = 0,
): ComputedProducerReceiptLineItem {
  const at = (field: string): string => `lineItems.${String(index)}.${field}`

  if (item.name.trim().length === 0) fail('Kalem adı boş olamaz.', at('name'))
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    fail('Miktar pozitif bir sayı olmalı.', at('quantity'))
  }
  if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    fail('Birim fiyat negatif olamaz.', at('unitPrice'))
  }

  const amountMinor = toMinor(item.quantity * item.unitPrice)
  const rates = item.taxRates ?? {}
  const taxAmounts = emptyTaxAmounts()
  const taxMinors: number[] = []

  for (const code of PRODUCER_RECEIPT_TAX_CODES) {
    const key = PRODUCER_RECEIPT_TAX_KEYS[code]
    const taxMinor = applyPercent(amountMinor, rates[key] ?? 0)
    taxAmounts[key] = fromMinor(taxMinor)
    taxMinors.push(taxMinor)
  }

  return {
    ...item,
    amount: fromMinor(amountMinor),
    taxAmounts,
    totalTaxes: fromMinor(sumMinor(taxMinors)),
  }
}

/**
 * Hesaplanmış kalemlerden belge düzeyi toplamları türetir.
 *
 * `odenecekTutar` bu belgenin ayırt edici noktasıdır: faturada olduğu gibi
 * vergiler EKLENMEZ, KESİLİR — müstahsile ödenecek tutar, vergiler dahil
 * toplamdan dört kesintinin düşülmüş hâlidir.
 *
 * @param lines Hesaplanmış kalemler; boş dizi geçerlidir (tüm toplamlar 0).
 * @returns Belge düzeyi toplamlar. `grandTotal` kalem toplamına EŞİTTİR
 *   (kesintiler eklenmez), `payableAmount` ise kesintiler düşülmüş hâlidir.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptLineItem, sumProducerReceiptTotals, Unit } from 'efatura'
 *
 * const lines = [
 *   computeProducerReceiptLineItem({
 *     name: 'Buğday',
 *     quantity: 100,
 *     unit: Unit.KILOGRAM,
 *     unitPrice: 12,
 *     taxRates: { incomeTaxWithholding: 2 },
 *   }),
 * ]
 * const totals = sumProducerReceiptTotals(lines)
 * // 1200 kalem toplamı, 1200 genel toplam, 1176 ödenecek.
 * console.log(totals.lineTotal, totals.grandTotal, totals.payableAmount)
 * ```
 */
export function sumProducerReceiptTotals(
  lines: readonly ComputedProducerReceiptLineItem[],
): ProducerReceiptTotals {
  const lineTotalMinor = sumMinor(lines.map((line) => toMinor(line.amount)))
  const taxAmounts = emptyTaxAmounts()

  for (const code of PRODUCER_RECEIPT_TAX_CODES) {
    const key = PRODUCER_RECEIPT_TAX_KEYS[code]
    taxAmounts[key] = fromMinor(sumMinor(lines.map((line) => toMinor(line.taxAmounts[key]))))
  }

  const totalTaxesMinor = sumMinor(
    PRODUCER_RECEIPT_TAX_CODES.map((code) => toMinor(taxAmounts[PRODUCER_RECEIPT_TAX_KEYS[code]])),
  )

  return {
    lineTotal: fromMinor(lineTotalMinor),
    taxAmounts,
    totalTaxes: fromMinor(totalTaxesMinor),
    grandTotal: fromMinor(lineTotalMinor),
    payableAmount: fromMinor(lineTotalMinor - totalTaxesMinor),
  }
}

/**
 * Kalemleri DOĞRULAYARAK hesaplar ve belge düzeyi toplamları türetir.
 *
 * @param items Hesaplanacak kalemler. BOŞ OLAMAZ.
 * @returns `lines` (hesaplanmış kalemler) ve `totals` (belge düzeyi
 *   toplamlar).
 * @throws {EArsivValidationError} Liste boşsa ya da bir kalem
 *   `computeProducerReceiptLineItem` doğrulamasından geçemezse.
 *
 * @example
 * ```ts
 * import { computeProducerReceiptTotals, Unit } from 'efatura'
 *
 * const { lines, totals } = computeProducerReceiptTotals([
 *   { name: 'Süt', quantity: 500, unit: Unit.LITRE, unitPrice: 15, taxRates: { pastureFund: 1 } },
 * ])
 * console.log(lines.length, totals.totalTaxes, totals.payableAmount)
 * ```
 */
export function computeProducerReceiptTotals(items: readonly ProducerReceiptLineItemInput[]): {
  lines: ComputedProducerReceiptLineItem[]
  totals: ProducerReceiptTotals
} {
  if (items.length === 0) {
    fail('Makbuz en az bir kalem içermeli.', 'lineItems')
  }

  const lines = items.map((item, index) => computeProducerReceiptLineItem(item, index))
  return { lines, totals: sumProducerReceiptTotals(lines) }
}
