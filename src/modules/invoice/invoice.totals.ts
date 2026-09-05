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
 *
 * @param item Hesaplanacak kalem; `name`, `quantity`, `unit`, `unitPrice` ve
 *   `vatRate` zorunludur.
 * @param index Kalemin fatura içindeki sırası; YALNIZCA hata mesajlarındaki
 *   yol için kullanılır (`lineItems.<index>.<alan>`). Varsayılan 0.
 * @returns Girdi alanlarının tamamını ve hesaplanan beş tutarı taşıyan kalem.
 * @throws {EArsivValidationError} `name` boşsa, `quantity` pozitif değilse,
 *   `unitPrice` negatifse ya da oranlardan biri [0, 100] dışındaysa.
 *
 * @example
 * ```ts
 * import { computeLineItem, Unit } from 'efatura'
 *
 * const line = computeLineItem({
 *   name: 'Danışmanlık',
 *   quantity: 4,
 *   unit: Unit.HOUR,
 *   unitPrice: 500,
 *   vatRate: 20,
 *   discountRate: 10,
 * })
 * // 2000 brüt, 200 iskonto, 1800 net, 360 KDV.
 * console.log(line.grossAmount, line.discountAmount, line.netAmount, line.vatAmount)
 * ```
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
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz.
 *
 * @param item Portaldan okunmuş kalem; alanları bozuk olabilir.
 * @returns Aynı şekilde hesaplanmış kalem; hiçbir koşulda fırlatmaz.
 *
 * @example Girdi ve çıktı
 * ```text
 * computeLineItemForRead({ name: '', quantity: -1, unit: 'C62', unitPrice: -5, vatRate: 500 })
 *   -> miktar 0, birim fiyat 0, KDV oranı 100'e kelepçelenir; tutarların hepsi 0
 * ```
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
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz — `computeTotals` bunu zaten
 * çağırır.
 *
 * @param lines Hesaplanmış kalemler; boş dizi geçerlidir (tüm toplamlar 0).
 * @returns Sekiz alanlı fatura toplamları. `payableAmount` her zaman
 *   `grandTotal` ile aynıdır.
 *
 * @example Girdi ve çıktı
 * ```text
 * sumTotals(kalemler) -> {
 *   lineTotal, totalDiscount, taxBase, calculatedVat,
 *   additionalTaxes, totalTaxes, grandTotal, payableAmount
 * }
 * ```
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
 *
 * @param items Hesaplanacak kalemler. BOŞ OLAMAZ.
 * @returns `lines` (hesaplanmış kalemler) ve `totals` (fatura düzeyi
 *   toplamlar).
 * @throws {EArsivValidationError} Liste boşsa ya da herhangi bir kalem
 *   `computeLineItem` doğrulamasından geçemezse — hata yolu hangi kalemin
 *   hangi alanının bozuk olduğunu söyler.
 *
 * @example
 * ```ts
 * import { computeTotals, Unit } from 'efatura'
 *
 * const { lines, totals } = computeTotals([
 *   { name: 'Hizmet', quantity: 2, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 },
 * ])
 * // 200 matrah, 40 KDV, 240 genel toplam.
 * console.log(lines.length, totals.taxBase, totals.calculatedVat, totals.grandTotal)
 * ```
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
 *
 * Doğrulanan eşitlikler: `taxBase = lineTotal − totalDiscount`,
 * `totalTaxes = calculatedVat + additionalTaxes`,
 * `grandTotal = taxBase + totalTaxes`, `payableAmount = grandTotal`.
 * Tolerans 1e-6'dır — kayan nokta gürültüsünü (~1e-13) geçirir ama bir
 * kuruşluk (0,01) gerçek uyumsuzluğu YAKALAR.
 *
 * @param computed Kalemlerden hesaplanmış toplamlar (`computeTotals` çıktısı).
 * @param override Çağıranın verdiği kısmi toplamlar. `undefined` ise
 *   `computed` aynen döner ve hiçbir kontrol yapılmaz.
 * @returns Birleştirilmiş ve eşitlikleri doğrulanmış toplamlar.
 * @throws {EArsivValidationError} Birleştirilmiş toplamlar eşitliklerden
 *   birini bozuyorsa; `issues` hangi alanın tutarsız olduğunu ve beklenen
 *   değeri söyler.
 *
 * @example Geçerli bir override
 * ```ts
 * import { computeTotals, mergeAndVerifyTotals, Unit } from 'efatura'
 *
 * const { totals } = computeTotals([
 *   { name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 },
 * ])
 * const merged = mergeAndVerifyTotals(totals, { payableAmount: 120 })
 * console.log(merged.payableAmount)
 * ```
 *
 * @example Tutarsız override reddedilir
 * ```ts
 * import { computeTotals, EArsivValidationError, mergeAndVerifyTotals, Unit } from 'efatura'
 *
 * const { totals } = computeTotals([
 *   { name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 },
 * ])
 * try {
 *   mergeAndVerifyTotals(totals, { grandTotal: 999 })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues[0]?.path)
 *   // 'totals.grandTotal'
 * }
 * ```
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
