import {
  PRODUCER_RECEIPT_TAX_CODES,
  PRODUCER_RECEIPT_TAX_TOTAL_FIELDS,
  type UnitCode,
} from '../../constants/index.js'
import { formatMinor, formatPortalDate, formatPortalTime, toMinor } from '../../core/index.js'
import { normalizeSummaryDate, num, str } from '../../documents/index.js'

import {
  computeProducerReceiptTotals,
  emptyTaxAmounts,
  PRODUCER_RECEIPT_TAX_KEYS,
} from './producer-receipt.totals.js'
import type {
  ComputedProducerReceiptLineItem,
  ProducerReceiptDetail,
  ProducerReceiptInput,
  ProducerReceiptTaxAmounts,
  ProducerReceiptTaxRates,
  ProducerReceiptTotals,
} from './producer-receipt.types.js'

/** Kalem düzeyindeki vergi çiftinin portal alan adları. */
const rateField = (code: string): string => `v${code}Orani`
const amountField = (code: string): string => `v${code}Tutari`

/**
 * Müstahsil makbuzu girdisini portalın beklediği Türkçe anahtarlı yüke
 * çevirir.
 *
 * `uuid`/`ettn` bilinçli olarak YOKTUR: portal makbuzlarda da ETTN'i kendisi
 * atar ve istemcinin gönderdiğini yok sayar (canlı doğrulandı 2026-09-05 —
 * gönderilen `8b3f591e-…` yerine `408cc357-…` üretildi). Bu yüzden
 * oluşturulan makbuzun kimliği anlık görüntü farkıyla çözülür.
 *
 * `hesaplanan*` belge düzeyi vergi toplamları da GÖNDERİLMEZ: portal bunları
 * kalemlerden türetiyor (canlı doğrulandı — gönderilmeden oluşturulan makbuz
 * doğru toplamlarla geri okundu).
 */
export function toPortalProducerReceipt(input: ProducerReceiptInput): Record<string, unknown> {
  const { lines, totals } = computeProducerReceiptTotals(input.lineItems)
  const date = formatPortalDate(input.date)

  return {
    vknTckn: input.producer.taxOrIdentityNumber,
    aliciAdi: input.producer.firstName ?? '',
    aliciSoyadi: input.producer.lastName ?? '',
    belgeNumarasi: input.documentNumber ?? '',
    tarih: date,
    saat: formatPortalTime(input.time),
    sehir: input.city ?? '',
    websitesi: input.website ?? '',
    not: input.note ?? '',
    // Teslim tarihi verilmezse belge tarihine düşer: alan portalın kendi
    // ekranında da zorunlu ve boş string bir tarih değildir.
    teslimTarih: input.deliveryDate === undefined ? date : formatPortalDate(input.deliveryDate),

    mustahsilTable: lines.map((line) => toPortalLine(line)),

    malhizmetToplamTutari: formatMinor(toMinor(totals.lineTotal)),
    vergilerDahilToplamTutar: formatMinor(toMinor(totals.grandTotal)),
    odenecekTutar: formatMinor(toMinor(totals.payableAmount)),
  }
}

function toPortalLine(line: ComputedProducerReceiptLineItem): Record<string, unknown> {
  const row: Record<string, unknown> = {
    malHizmet: line.name,
    miktar: line.quantity,
    birim: line.unit,
    birimFiyat: formatMinor(toMinor(line.unitPrice)),
    malHizmetTutari: formatMinor(toMinor(line.amount)),
  }

  for (const code of PRODUCER_RECEIPT_TAX_CODES) {
    const key = PRODUCER_RECEIPT_TAX_KEYS[code]
    row[rateField(code)] = line.taxRates?.[key] ?? 0
    row[amountField(code)] = formatMinor(toMinor(line.taxAmounts[key]))
  }

  return row
}

const asRow = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/**
 * Detay yanıtındaki bir kalemi okur.
 *
 * Okuma yolu yeniden HESAPLAMAZ: portal kalem düzeyinde hem oranları hem
 * tutarları döndürüyor ve kayıtlı olan rakam GİB'in tuttuğu rakamdır. Bu,
 * faturadaki `portalTotals` kararının (I4) aynısıdır — kütüphanenin kendi
 * aritmetiği resmi rakamların yerine geçmemeli.
 */
function toDetailLine(raw: unknown): ComputedProducerReceiptLineItem {
  const row = asRow(raw)
  const taxRates: ProducerReceiptTaxRates = {}
  const taxAmounts: ProducerReceiptTaxAmounts = emptyTaxAmounts()
  let totalTaxesMinor = 0

  for (const code of PRODUCER_RECEIPT_TAX_CODES) {
    const key = PRODUCER_RECEIPT_TAX_KEYS[code]
    taxRates[key] = num(row[rateField(code)])
    const amountMinor = toMinor(num(row[amountField(code)]))
    taxAmounts[key] = amountMinor / 100
    totalTaxesMinor += amountMinor
  }

  return {
    name: str(row.malHizmet),
    quantity: num(row.miktar),
    unit: str(row.birim, 'C62') as UnitCode,
    unitPrice: num(row.birimFiyat),
    taxRates,
    amount: num(row.malHizmetTutari),
    taxAmounts,
    totalTaxes: totalTaxesMinor / 100,
  }
}

/**
 * Belge düzeyi toplamları PORTALIN KENDİ yanıtından okur.
 *
 * Portal makbuz tutarlarını doğrulamıyor ve yeniden hesaplamıyor — kasıtlı
 * yanlış bir `odenecekTutar` (77,77 yerine 98,00) aynen saklanıp geri
 * döndü (canlı doğrulandı 2026-09-05). Bu yüzden okuma yolu kayıtlı rakamı
 * raporlar; aritmetiğimizi resmi kaydın yerine koymaz.
 */
function toDetailTotals(raw: Record<string, unknown>): ProducerReceiptTotals {
  const taxAmounts = emptyTaxAmounts()
  let totalTaxesMinor = 0

  for (const code of PRODUCER_RECEIPT_TAX_CODES) {
    const key = PRODUCER_RECEIPT_TAX_KEYS[code]
    // Alan adları TÜRETİLEBİLİR DEĞİL: SGK_PRIM girdisi diğer üçünden farklı
    // olarak `Tutari` ekiyle bitiyor (bkz. PRODUCER_RECEIPT_TAX_TOTAL_FIELDS).
    const amountMinor = toMinor(num(raw[PRODUCER_RECEIPT_TAX_TOTAL_FIELDS[code]]))
    taxAmounts[key] = amountMinor / 100
    totalTaxesMinor += amountMinor
  }

  return {
    lineTotal: num(raw.malhizmetToplamTutari),
    taxAmounts,
    totalTaxes: totalTaxesMinor / 100,
    grandTotal: num(raw.vergilerDahilToplamTutar),
    payableAmount: num(raw.odenecekTutar),
  }
}

/**
 * Portalın makbuz detay yanıtını `ProducerReceiptDetail`'e çevirir.
 *
 * Kimlik alanı `uuid`'dir (faturada `faturaUuid`, SMM'de `ettn`); yanıtta
 * bulunamazsa istenen ETTN'e düşülür.
 *
 * @param raw `EARSIV_PORTAL_MUSTAHSIL_GETIR` yanıtının `data` alanı.
 * @param requestedEttn İstekte kullanılan ETTN; yanıtta `uuid` yoksa bu
 *   değer kullanılır.
 * @returns Eşlenmiş detay. Tutarlar YENİDEN HESAPLANMAZ; portalın kendi
 *   rakamları okunur. `note` alanının sonundaki tek satır sonu kırpılır.
 *
 * @example
 * ```ts
 * import { toProducerReceiptDetail } from '@yankikucuk/efatura'
 *
 * const detail = toProducerReceiptDetail(
 *   {
 *     uuid: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 *     belgeNumarasi: 'EAR2026000000123',
 *     tarih: '05-09-2026',
 *     not: 'Makbuz notu\n',
 *     mustahsilTable: [{ malHizmet: 'Buğday', miktar: 100, birimFiyat: 12 }],
 *     odenecekTutar: 1176,
 *   },
 *   '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
 * )
 * console.log(detail.date, detail.note, detail.totals.payableAmount)
 * // '05/09/2026' 'Makbuz notu' 1176
 * ```
 */
export function toProducerReceiptDetail(
  raw: Record<string, unknown>,
  requestedEttn: string,
): ProducerReceiptDetail {
  const table = Array.isArray(raw.mustahsilTable) ? raw.mustahsilTable : []

  return {
    ettn: str(raw.uuid, requestedEttn),
    documentNumber: str(raw.belgeNumarasi),
    // formatPortalDate boş stringte fırlatır; tek bozuk alan çağıranın
    // `raw`'a erişimini bile engellememeli (I5'in okuma yolundaki karşılığı).
    date: normalizeSummaryDate(raw.tarih),
    time: str(raw.saat),
    producer: {
      taxOrIdentityNumber: str(raw.vknTckn),
      firstName: str(raw.aliciAdi),
      lastName: str(raw.aliciSoyadi),
    },
    city: str(raw.sehir),
    website: str(raw.websitesi),
    // Portal `not` alanının SONUNA bir satır sonu EKLİYOR ("Makbuz notu\n");
    // canlı doğrulandı. Kırpılmazsa her gidiş-dönüş karşılaştırması yanlış
    // negatif verir. Yalnızca portalın eklediği TEK sondaki satır sonu
    // atılır, kullanıcının kendi metni korunur.
    note: str(raw.not).replace(/\n$/, ''),
    deliveryDate: str(raw.teslimTarih),
    lineItems: table.map(toDetailLine),
    totals: toDetailTotals(raw),
    raw,
  }
}
