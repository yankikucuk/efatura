import {
  applyPercent,
  EArsivValidationError,
  fromMinor,
  sumMinor,
  toMinor,
} from '../../core/index.js'

import type {
  ComputedSelfEmployedReceiptLineItem,
  SelfEmployedReceiptLineItemInput,
  SelfEmployedReceiptTotals,
} from './self-employed-receipt.types.js'

const fail = (message: string, path: string): never => {
  throw new EArsivValidationError(message, [{ path, message }])
}

const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0

/**
 * Serbest meslek makbuzunun tutar zinciri — tam sayı kuruş üzerinde.
 *
 *     stopaj          = brüt ücret × stopaj oranı
 *     net ücret       = brüt ücret − stopaj
 *     KDV             = BRÜT ÜCRET × KDV oranı        (matrah net ücret DEĞİL)
 *     KDV tevkifatı   = KDV × tevkifat oranı
 *     tahsil edilen   = KDV − KDV tevkifatı
 *     net alınan      = net ücret + tahsil edilen KDV
 *
 * En kritik satır KDV matrahıdır: net ücret üzerinden hesaplamak, stopajın
 * KDV matrahını da düşürmesi anlamına gelirdi ki mevzuata aykırıdır ve
 * her makbuzda sessiz bir eksik KDV üretirdi.
 *
 * Portal bu hesabın HİÇBİRİNİ yapmıyor: gönderilen alanları olduğu gibi
 * saklıyor, göndermediklerimizi 0 bırakıyor (canlı doğrulandı 2026-09-05).
 * Yani bu fonksiyon belgenin doğruluğunun TEK güvencesidir.
 */
function chain(
  item: SelfEmployedReceiptLineItemInput,
  clamp: boolean,
): ComputedSelfEmployedReceiptLineItem {
  const rate = (value: number | undefined): number =>
    clamp ? clampPercent(value ?? 0) : (value ?? 0)

  const grossMinor = toMinor(clamp && !(item.grossFee >= 0) ? 0 : item.grossFee)
  const withholdingMinor = applyPercent(grossMinor, rate(item.withholdingRate))
  const netFeeMinor = grossMinor - withholdingMinor
  const vatMinor = applyPercent(grossMinor, rate(item.vatRate))
  const vatWithholdingMinor = applyPercent(vatMinor, rate(item.vatWithholdingRate))
  const collectedVatMinor = vatMinor - vatWithholdingMinor

  return {
    ...item,
    withholdingAmount: fromMinor(withholdingMinor),
    netFee: fromMinor(netFeeMinor),
    vatAmount: fromMinor(vatMinor),
    vatWithholdingAmount: fromMinor(vatWithholdingMinor),
    collectedVat: fromMinor(collectedVatMinor),
    netReceived: fromMinor(netFeeMinor + collectedVatMinor),
  }
}

/**
 * Tek bir kalemi DOĞRULAYARAK hesaplar (yazma yolu).
 *
 * Zincir: stopaj = brüt × stopaj oranı; net ücret = brüt − stopaj;
 * KDV = BRÜT × KDV oranı (matrah net ücret DEĞİL); KDV tevkifatı = KDV ×
 * tevkifat oranı; tahsil edilen KDV = KDV − tevkifat; net alınan = net ücret
 * + tahsil edilen KDV.
 *
 * @param item Hesaplanacak kalem; `description`, `grossFee` ve `vatRate`
 *   zorunludur. `withholdingRate` ve `vatWithholdingRate` verilmezse 0
 *   sayılır. Oranlar KELEPÇELENMEZ — aralık dışı bir değer `applyPercent`
 *   içinde hataya yol açar.
 * @param index Kalemin belge içindeki sırası; YALNIZCA hata mesajlarındaki
 *   yol için kullanılır. Varsayılan 0.
 * @returns Girdi alanlarının tamamını ve hesaplanan altı tutarı taşıyan
 *   kalem.
 * @throws {EArsivValidationError} `description` boşsa, `grossFee` sonlu
 *   değilse ya da negatifse, veya bir oran [0, 100] dışındaysa.
 *
 * @example
 * ```ts
 * import { computeSelfEmployedReceiptLineItem } from '@yankikucuk/efatura'
 *
 * const line = computeSelfEmployedReceiptLineItem({
 *   description: 'Mali müşavirlik',
 *   grossFee: 10_000,
 *   vatRate: 20,
 *   withholdingRate: 20,
 *   vatWithholdingRate: 50,
 * })
 * // 2000 stopaj, 8000 net ücret, 2000 KDV, 1000 tevkifat, 1000 tahsil, 9000 net alınan.
 * console.log(line.withholdingAmount, line.netFee, line.vatAmount, line.netReceived)
 * ```
 */
export function computeSelfEmployedReceiptLineItem(
  item: SelfEmployedReceiptLineItemInput,
  index = 0,
): ComputedSelfEmployedReceiptLineItem {
  const at = (field: string): string => `lineItems.${String(index)}.${field}`

  if (item.description.trim().length === 0) {
    fail('Ücretin ne için alındığı boş olamaz.', at('description'))
  }
  if (!Number.isFinite(item.grossFee) || item.grossFee < 0) {
    fail('Brüt ücret negatif olamaz.', at('grossFee'))
  }

  return chain(item, false)
}

/**
 * `computeSelfEmployedReceiptLineItem` ile AYNI zinciri, girdi doğrulaması
 * YAPMADAN uygular. Yalnızca okuma yolunda kullanılır: portaldan gelen bir
 * kayıt reddedilecek bir "girdi" değildir ve reddedilirse çağıran
 * `detail.raw`'a bile erişemez (faturadaki I4 kararı). Oranlar [0, 100]
 * aralığına kelepçelenir, böylece `applyPercent` hiçbir koşulda fırlatamaz.
 *
 * @param item Portaldan okunmuş kalem; alanları bozuk olabilir. Negatif ya da
 *   sonlu olmayan `grossFee` 0 sayılır, oranlar [0, 100] aralığına
 *   kelepçelenir.
 * @returns Aynı zincirle hesaplanmış kalem; HİÇBİR koşulda fırlatmaz.
 *
 * @example
 * ```ts
 * import { computeSelfEmployedReceiptLineItemForRead } from '@yankikucuk/efatura'
 *
 * // Portalda kayıtlı bozuk bir satır bile çağrıyı düşürmez.
 * const line = computeSelfEmployedReceiptLineItemForRead({
 *   description: '',
 *   grossFee: -5,
 *   vatRate: 500,
 * })
 * console.log(line.netFee, line.vatAmount) // 0 0
 * ```
 */
export function computeSelfEmployedReceiptLineItemForRead(
  item: SelfEmployedReceiptLineItemInput,
): ComputedSelfEmployedReceiptLineItem {
  return chain(item, true)
}

/**
 * Hesaplanmış kalemlerden yedi belge toplamını türetir.
 *
 * Her toplam, ilgili kalem alanlarının KURUŞ üzerinden toplamıdır; belge
 * toplamı ile kalem toplamı arasında bir kuruş sapma oluşmaz.
 *
 * @param lines Hesaplanmış kalemler; boş dizi geçerlidir (tüm toplamlar 0).
 * @returns Yedi alanlı belge toplamları.
 *
 * @example
 * ```ts
 * import {
 *   computeSelfEmployedReceiptLineItem,
 *   sumSelfEmployedReceiptTotals,
 * } from '@yankikucuk/efatura'
 *
 * const lines = [
 *   computeSelfEmployedReceiptLineItem({
 *     description: 'Danışmanlık',
 *     grossFee: 10_000,
 *     vatRate: 20,
 *     withholdingRate: 20,
 *   }),
 * ]
 * const totals = sumSelfEmployedReceiptTotals(lines)
 * console.log(totals.grossFee, totals.withholding, totals.netFee, totals.netReceived)
 * ```
 */
export function sumSelfEmployedReceiptTotals(
  lines: readonly ComputedSelfEmployedReceiptLineItem[],
): SelfEmployedReceiptTotals {
  const sum = (pick: (line: ComputedSelfEmployedReceiptLineItem) => number): number =>
    sumMinor(lines.map((line) => toMinor(pick(line))))

  const grossMinor = sum((line) => line.grossFee)
  const withholdingMinor = sum((line) => line.withholdingAmount)
  const netFeeMinor = sum((line) => line.netFee)
  const vatMinor = sum((line) => line.vatAmount)
  const vatWithholdingMinor = sum((line) => line.vatWithholdingAmount)
  const collectedVatMinor = sum((line) => line.collectedVat)
  const netReceivedMinor = sum((line) => line.netReceived)

  return {
    grossFee: fromMinor(grossMinor),
    withholding: fromMinor(withholdingMinor),
    netFee: fromMinor(netFeeMinor),
    vat: fromMinor(vatMinor),
    vatWithholding: fromMinor(vatWithholdingMinor),
    collectedVat: fromMinor(collectedVatMinor),
    netReceived: fromMinor(netReceivedMinor),
  }
}

/**
 * Kalemleri DOĞRULAYARAK hesaplar ve belge toplamlarını türetir.
 *
 * @param items Hesaplanacak kalemler. BOŞ OLAMAZ.
 * @returns `lines` (hesaplanmış kalemler) ve `totals` (yedi belge toplamı).
 * @throws {EArsivValidationError} Liste boşsa ya da bir kalem
 *   `computeSelfEmployedReceiptLineItem` doğrulamasından geçemezse.
 *
 * @example
 * ```ts
 * import { computeSelfEmployedReceiptTotals } from '@yankikucuk/efatura'
 *
 * const { lines, totals } = computeSelfEmployedReceiptTotals([
 *   { description: 'Danışmanlık', grossFee: 5_000, vatRate: 20, withholdingRate: 20 },
 * ])
 * console.log(lines.length, totals.netReceived)
 * ```
 */
export function computeSelfEmployedReceiptTotals(
  items: readonly SelfEmployedReceiptLineItemInput[],
): {
  lines: ComputedSelfEmployedReceiptLineItem[]
  totals: SelfEmployedReceiptTotals
} {
  if (items.length === 0) {
    fail('Makbuz en az bir kalem içermeli.', 'lineItems')
  }

  const lines = items.map((item, index) => computeSelfEmployedReceiptLineItem(item, index))
  return { lines, totals: sumSelfEmployedReceiptTotals(lines) }
}
