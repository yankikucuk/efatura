import { Country, Currency, type CurrencyCode } from '../../constants/index.js'
import { formatMinor, formatPortalDate, formatPortalTime, toMinor } from '../../core/index.js'
import { normalizeSummaryDate, num, str } from '../../documents/index.js'

import {
  computeSelfEmployedReceiptLineItemForRead,
  computeSelfEmployedReceiptTotals,
} from './self-employed-receipt.totals.js'
import type {
  ComputedSelfEmployedReceiptLineItem,
  SelfEmployedReceiptDetail,
  SelfEmployedReceiptInput,
  SelfEmployedReceiptTotals,
} from './self-employed-receipt.types.js'

/**
 * Serbest meslek makbuzu girdisini portalın beklediği Türkçe anahtarlı yüke
 * çevirir.
 *
 * İki nokta referans PHP kütüphanesinden BİLİNÇLİ olarak ayrılır:
 *
 * 1. `ettn`/`uuid` gönderilmez — portal makbuzlarda da kimliği kendisi atar.
 * 2. Referanstaki `xxx: 0` alanı gönderilmez; canlı doğrulandı 2026-09-05,
 *    alansız oluşturma başarılı.
 *
 * Kalem düzeyindeki TÜRETİLMİŞ tutarlar (`netUcret`, `netAlinan`) MUTLAKA
 * gönderilir: portal bunları hesaplamıyor, gönderilmezse 0 olarak saklıyor
 * (canlı doğrulandı — 500 ₺ brüt ücretli bir makbuz "net alınan: 0" olarak
 * kaydedildi).
 */
export function toPortalSelfEmployedReceipt(
  input: SelfEmployedReceiptInput,
): Record<string, unknown> {
  const { lines, totals } = computeSelfEmployedReceiptTotals(input.lineItems)
  const address = input.payer.address ?? {}

  return {
    vknTckn: input.payer.taxOrIdentityNumber,
    belgeNumarasi: input.documentNumber ?? '',
    tarih: formatPortalDate(input.date),
    saat: formatPortalTime(input.time),
    paraBirimi: input.currency ?? Currency.TURKISH_LIRA,
    kur: input.currencyRate === undefined ? '0' : String(input.currencyRate),

    unvan: input.payer.title ?? '',
    adi: input.payer.firstName ?? '',
    soyadi: input.payer.lastName ?? '',
    vergiDairesi: input.payer.taxOffice ?? '',

    // DİKKAT: adres anahtarı faturadakinden FARKLI yazılıyor — burada
    // `bulvarCaddeSokak`, faturada tamamı küçük `bulvarcaddesokak`.
    bulvarCaddeSokak: address.street ?? '',
    binaAdi: address.buildingName ?? '',
    binaNo: address.buildingNumber ?? '',
    kapiNo: address.doorNumber ?? '',
    kasabaKoy: address.town ?? '',
    mahalleSemtIlce: address.district ?? '',
    sehir: address.city ?? '',
    ulke: address.country ?? Country.TURKIYE,
    postaKodu: address.postalCode ?? '',

    aciklama: input.description ?? '',
    // Portal bu alanı boolean olarak saklıyor ve boolean olarak geri veriyor.
    kdvTahakkukIcin: input.forVatAccrual ?? false,

    serbestTable: lines.map((line) => ({
      neIcinAlindigi: line.description,
      brutUcret: formatMinor(toMinor(line.grossFee)),
      kdv: line.vatRate,
      stopaj: line.withholdingRate ?? 0,
      netUcret: formatMinor(toMinor(line.netFee)),
      kdvTevkifatOrani: line.vatWithholdingRate ?? 0,
      netAlinan: formatMinor(toMinor(line.netReceived)),
    })),

    brtUcret: formatMinor(toMinor(totals.grossFee)),
    gvStpjTtari: formatMinor(toMinor(totals.withholding)),
    netUcretTtr: formatMinor(toMinor(totals.netFee)),
    kdvTtri: formatMinor(toMinor(totals.vat)),
    kdvTvkftTtri: formatMinor(toMinor(totals.vatWithholding)),
    thsilEdilenKdv: formatMinor(toMinor(totals.collectedVat)),
    netAlinanToplam: formatMinor(toMinor(totals.netReceived)),
  }
}

const asRow = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

/**
 * Detay yanıtındaki bir kalemi okur ve türetilmiş tutarları YENİDEN
 * HESAPLAR.
 *
 * Portal kalem düzeyinde stopaj, KDV ve KDV tevkifatı TUTARLARINI hiç
 * döndürmez — yalnızca oranları gelir. `netUcret` ve `netAlinan` alanları
 * gelir ama bunlar portalın hesabı DEĞİL, oluşturma sırasında gönderilenin
 * yankısıdır; gönderilmedikleri durumda 0 olarak saklanmışlardır (canlı
 * doğrulandı). Bu yüzden altı türetilmiş değerin tamamı oranlardan
 * hesaplanır; portalın sakladığı ham değerlere `detail.raw` üzerinden
 * erişilebilir.
 *
 * Bu, BELGE düzeyi toplamlar için geçerli DEĞİLDİR: onlar portalın kendi
 * kaydından okunur (bkz. `toDetailTotals`).
 */
function toDetailLine(raw: unknown): ComputedSelfEmployedReceiptLineItem {
  const row = asRow(raw)
  return computeSelfEmployedReceiptLineItemForRead({
    description: str(row.neIcinAlindigi),
    grossFee: num(row.brutUcret),
    vatRate: num(row.kdv),
    withholdingRate: num(row.stopaj),
    vatWithholdingRate: num(row.kdvTevkifatOrani),
  })
}

/**
 * Belge düzeyi toplamları PORTALIN KENDİ kaydından okur.
 *
 * Portal tutarları doğrulamıyor (müstahsil tarafında canlı kanıtlandı:
 * kasıtlı yanlış bir toplam aynen saklandı), ama kayıtlı olan rakam GİB'in
 * tuttuğu rakamdır. Kütüphanenin aritmetiğini onun yerine koymak, resmi
 * kayıtla çelişen bir rapor üretirdi (faturadaki I4 kararı).
 */
function toDetailTotals(raw: Record<string, unknown>): SelfEmployedReceiptTotals {
  return {
    grossFee: num(raw.brtUcret),
    withholding: num(raw.gvStpjTtari),
    netFee: num(raw.netUcretTtr),
    vat: num(raw.kdvTtri),
    vatWithholding: num(raw.kdvTvkftTtri),
    collectedVat: num(raw.thsilEdilenKdv),
    netReceived: num(raw.netAlinanToplam),
  }
}

/**
 * Portalın SMM detay yanıtını `SelfEmployedReceiptDetail`'e çevirir.
 * Kimlik alanı `ettn`'dir (müstahsilde `uuid`).
 */
export function toSelfEmployedReceiptDetail(
  raw: Record<string, unknown>,
  requestedEttn: string,
): SelfEmployedReceiptDetail {
  const table = Array.isArray(raw.serbestTable) ? raw.serbestTable : []

  return {
    ettn: str(raw.ettn, requestedEttn),
    documentNumber: str(raw.belgeNumarasi),
    // Boş tarih `formatPortalDate` içinde fırlatır; tek bozuk alan çağıranın
    // `raw`'a erişimini engellememeli (I5'in okuma yolundaki karşılığı).
    date: normalizeSummaryDate(raw.tarih),
    time: str(raw.saat),
    currency: str(raw.paraBirimi, Currency.TURKISH_LIRA) as CurrencyCode,
    currencyRate: num(raw.kur),
    payer: {
      taxOrIdentityNumber: str(raw.vknTckn),
      title: str(raw.unvan),
      firstName: str(raw.adi),
      lastName: str(raw.soyadi),
      taxOffice: str(raw.vergiDairesi),
      address: {
        country: str(raw.ulke, Country.TURKIYE),
        city: str(raw.sehir),
        district: str(raw.mahalleSemtIlce),
        street: str(raw.bulvarCaddeSokak),
        buildingName: str(raw.binaAdi),
        buildingNumber: str(raw.binaNo),
        doorNumber: str(raw.kapiNo),
        town: str(raw.kasabaKoy),
        postalCode: str(raw.postaKodu),
      },
    },
    description: str(raw.aciklama),
    forVatAccrual: raw.kdvTahakkukIcin === true,
    lineItems: table.map(toDetailLine),
    totals: toDetailTotals(raw),
    raw,
  }
}
