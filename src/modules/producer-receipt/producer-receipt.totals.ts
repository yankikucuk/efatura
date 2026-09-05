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
 */
export const PRODUCER_RECEIPT_TAX_KEYS: Readonly<
  Record<ProducerReceiptTaxCode, keyof ProducerReceiptTaxRates>
> = {
  [ProducerReceiptTax.INCOME_TAX_WITHHOLDING]: 'incomeTaxWithholding',
  [ProducerReceiptTax.PASTURE_FUND]: 'pastureFund',
  [ProducerReceiptTax.STOCK_EXCHANGE_REGISTRATION]: 'stockExchangeRegistration',
  [ProducerReceiptTax.SOCIAL_SECURITY_PREMIUM]: 'socialSecurityPremium',
}

/** Dört alanı da sıfırla açan boş bir kesinti tablosu. */
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

/** Kalemleri DOĞRULAYARAK hesaplar ve belge düzeyi toplamları türetir. */
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
