import {
  applyPercent,
  EArsivValidationError,
  fromMinor,
  sumMinor,
  toMinor,
} from '../../core/index.js'

import type { ComputedLineItem, InvoiceTotals, LineItemInput } from './invoice.types.js'

const fail = (message: string, path: string): never => {
  throw new EArsivValidationError(message, [{ path, message }])
}

/**
 * Tek bir kalemin tutarlarını hesaplar. Tüm ara adımlar tam sayı kuruş
 * üzerinden yapılır; sonuç lira cinsine çevrilirken zaten yuvarlanmıştır.
 */
export function computeLineItem(item: LineItemInput, index = 0): ComputedLineItem {
  const at = (field: string): string => `lineItems.${String(index)}.${field}`

  if (item.name.trim().length === 0) fail('Kalem adı boş olamaz.', at('name'))
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    fail('Miktar pozitif bir sayı olmalı.', at('quantity'))
  }
  if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    fail('Birim fiyat negatif olamaz.', at('unitPrice'))
  }

  const grossMinor = toMinor(item.quantity * item.unitPrice)
  const discountMinor = applyPercent(grossMinor, item.discountRate ?? 0)
  const netMinor = grossMinor - discountMinor
  const vatMinor = applyPercent(netMinor, item.vatRate)
  const additionalTaxMinor = applyPercent(netMinor, item.additionalTaxRate ?? 0)

  return {
    ...item,
    grossAmount: fromMinor(grossMinor),
    discountAmount: fromMinor(discountMinor),
    netAmount: fromMinor(netMinor),
    vatAmount: fromMinor(vatMinor),
    additionalTaxAmount: fromMinor(additionalTaxMinor),
  }
}

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0

/**
 * `computeLineItem` ile AYNI aritmetiği, girdi doğrulaması YAPMADAN uygular.
 *
 * Yalnızca okuma yolunda (`InvoiceService.getInvoice`) kullanılır. Portaldan
 * gelen bir satır zaten var olan bir kaydın parçasıdır — reddedilecek bir
 * "girdi" değildir (bkz. I4). Miktar/birim fiyat negatif veya sonlu değilse
 * sessizce 0 kabul edilir; yüzde alanları [0, 100] aralığına kelepçelenir.
 * Böylece `toMinor`/`applyPercent` hiçbir koşulda fırlatamaz — okuma asla bir
 * `EArsivValidationError` üretmez.
 */
export function computeLineItemForRead(item: LineItemInput): ComputedLineItem {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
  const unitPrice = Number.isFinite(item.unitPrice) && item.unitPrice >= 0 ? item.unitPrice : 0

  const grossMinor = toMinor(quantity * unitPrice)
  const discountMinor = applyPercent(grossMinor, clampPercent(item.discountRate ?? 0))
  const netMinor = grossMinor - discountMinor
  const vatMinor = applyPercent(netMinor, clampPercent(item.vatRate))
  const additionalTaxMinor = applyPercent(netMinor, clampPercent(item.additionalTaxRate ?? 0))

  return {
    ...item,
    grossAmount: fromMinor(grossMinor),
    discountAmount: fromMinor(discountMinor),
    netAmount: fromMinor(netMinor),
    vatAmount: fromMinor(vatMinor),
    additionalTaxAmount: fromMinor(additionalTaxMinor),
  }
}

/**
 * Hesaplanmış kalemlerden fatura düzeyi toplamları türetir. Toplamlar
 * yuvarlanmış kalem değerlerinden gelir; böylece kalem toplamı ile fatura
 * toplamı hiçbir zaman bir kuruş sapmaz. `computeTotals` (yazma yolu) ve
 * `InvoiceService.getInvoice`'in okuma yolu (bkz. I4) tarafından paylaşılır.
 */
export function sumTotals(lines: readonly ComputedLineItem[]): InvoiceTotals {
  const lineTotalMinor = sumMinor(lines.map((line) => toMinor(line.grossAmount)))
  const discountMinor = sumMinor(lines.map((line) => toMinor(line.discountAmount)))
  const taxBaseMinor = sumMinor(lines.map((line) => toMinor(line.netAmount)))
  const vatMinor = sumMinor(lines.map((line) => toMinor(line.vatAmount)))
  const additionalMinor = sumMinor(lines.map((line) => toMinor(line.additionalTaxAmount)))
  const totalTaxesMinor = vatMinor + additionalMinor
  const grandTotalMinor = taxBaseMinor + totalTaxesMinor

  return {
    lineTotal: fromMinor(lineTotalMinor),
    totalDiscount: fromMinor(discountMinor),
    taxBase: fromMinor(taxBaseMinor),
    calculatedVat: fromMinor(vatMinor),
    additionalTaxes: fromMinor(additionalMinor),
    totalTaxes: fromMinor(totalTaxesMinor),
    grandTotal: fromMinor(grandTotalMinor),
    payableAmount: fromMinor(grandTotalMinor),
  }
}

/**
 * Kalemleri DOĞRULAYARAK hesaplar ve fatura düzeyi toplamları türetir.
 * Yazma yolunda (`createDraft`) kullanılır — bkz. `computeLineItemForRead`
 * okuma yolu için doğrulamasız eşdeğeri.
 */
export function computeTotals(items: readonly LineItemInput[]): {
  lines: ComputedLineItem[]
  totals: InvoiceTotals
} {
  if (items.length === 0) {
    fail('Fatura en az bir kalem içermeli.', 'lineItems')
  }

  const lines = items.map((item, index) => computeLineItem(item, index))
  return { lines, totals: sumTotals(lines) }
}

/**
 * Çağıranın verdiği kısmi toplamları hesaplananın üzerine yazar ve sonucun
 * §7.2 eşitliklerini bozmadığını doğrular. Tek bir alanı geçersiz kılıp
 * diğerlerini sessizce tutarsız bırakmayı engeller.
 */
export function mergeAndVerifyTotals(
  computed: InvoiceTotals,
  override: Partial<InvoiceTotals> | undefined,
): InvoiceTotals {
  if (override === undefined) return computed

  const merged: InvoiceTotals = { ...computed, ...override }
  const issues: { path: string; message: string }[] = []

  const check = (field: keyof InvoiceTotals, expected: number): void => {
    const actual = merged[field]
    // Gerçek bir uyumsuzluk en az bir kuruş (0.01) fark eder; buradaki
    // sapma yalnızca birkaç çıkarmadan gelen kayan nokta gürültüsüdür
    // (~1e-13). Yarım kuruşluk tolerans, kuruşa hizalanmamış bir override'ı
    // sessizce kabul ederdi.
    if (Math.abs(actual - expected) > 1e-6) {
      issues.push({
        path: `totals.${field}`,
        message: `${field} tutarsız: verilen ${String(actual)}, hesaplanan ${String(expected)}.`,
      })
    }
  }

  check('taxBase', merged.lineTotal - merged.totalDiscount)
  // KDV'yi de bağla: bu kontrol olmadan yalnızca `calculatedVat` override
  // eden bir çağıran hiçbir eşitliğe takılmaz ve uydurduğu değer doğrudan
  // portalın `hesaplanankdv` alanına giderdi.
  check('totalTaxes', merged.calculatedVat + merged.additionalTaxes)
  check('grandTotal', merged.taxBase + merged.totalTaxes)
  check('payableAmount', merged.grandTotal)

  if (issues.length > 0) {
    throw new EArsivValidationError(
      'Verilen toplamlar kendi içinde tutarsız. Alanları düzeltin veya totals alanını hiç vermeyin.',
      issues,
    )
  }

  return merged
}
