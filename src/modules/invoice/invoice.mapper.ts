import {
  ApprovalStatus,
  type ApprovalStatusValue,
  Country,
  Currency,
  type CurrencyCode,
  DocumentType,
  type DocumentTypeCode,
  InvoiceListKind,
  InvoiceType,
  type InvoiceTypeCode,
} from '../../constants/index.js'
import { formatMinor, formatPortalDate, formatPortalTime, toMinor } from '../../core/index.js'

import { computeTotals, mergeAndVerifyTotals } from './invoice.totals.js'
import type { InvoiceInput, InvoiceSummary, InvoiceTotals, LineItemInput } from './invoice.types.js'

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

/**
 * Portalın sayısal alanlarını ayrıştırır.
 *
 * Türkçe biçim binlik ayırıcı olarak nokta, ondalık ayırıcı olarak virgül
 * kullanır (`"1.234,56"`). Eski sürüm yalnızca virgülü noktaya çeviriyordu
 * (`value.replace(',', '.')`) — binlik noktayı ayıklamadığı için
 * `"1.234,56"` `"1.234.56"` olarak `NaN`'a düşüyor ve ₺999 üzeri her tutar
 * sessizce 0 olarak raporlanıyordu (bkz. I4). Virgül varsa Türkçe biçim
 * kabul edilir (noktalar ayıklanır, virgül ondalık noktaya çevrilir);
 * virgül yoksa nokta zaten ondalık ayırıcıdır (`"1234.56"`, `"1234"`).
 */
export const num = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed
    const parsed = Number(normalized)
    if (normalized.length > 0 && Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/**
 * Fatura girdisini portalın beklediği Türkçe anahtarlı yüke çevirir.
 *
 * `faturaUuid` bilinçli olarak YOKTUR: güncel portal istemci tarafından
 * verilen ETTN'i reddediyor ve kendisi atıyor (spec §2.3).
 */
export function toPortalInvoice(input: InvoiceInput): Record<string, unknown> {
  const { lines, totals: computed } = computeTotals(input.lineItems)
  const totals = mergeAndVerifyTotals(computed, input.totals)

  const address = input.buyer.address ?? {}
  const contact = input.buyer.contact ?? {}
  const receipt = input.receipt ?? {}
  const specialBase = input.specialBase ?? {}

  return {
    belgeNumarasi: input.documentNumber ?? '',
    faturaTarihi: formatPortalDate(input.date),
    saat: formatPortalTime(input.time),
    paraBirimi: input.currency ?? Currency.TURKISH_LIRA,
    dovzTLkur: input.currencyRate === undefined ? '0' : String(input.currencyRate),
    faturaTipi: input.invoiceType ?? InvoiceType.SALE,
    hangiTip: InvoiceListKind.INTERACTIVE,

    vknTckn: input.buyer.taxOrIdentityNumber,
    aliciUnvan: input.buyer.title ?? '',
    aliciAdi: input.buyer.firstName ?? '',
    aliciSoyadi: input.buyer.lastName ?? '',
    vergiDairesi: input.buyer.taxOffice ?? '',

    ulke: address.country ?? Country.TURKIYE,
    sehir: address.city ?? '',
    mahalleSemtIlce: address.district ?? '',
    bulvarcaddesokak: address.street ?? '',
    binaAdi: address.buildingName ?? '',
    binaNo: address.buildingNumber ?? '',
    kapiNo: address.doorNumber ?? '',
    kasabaKoy: address.town ?? '',
    postaKodu: address.postalCode ?? '',

    tel: contact.phone ?? '',
    fax: contact.fax ?? '',
    eposta: contact.email ?? '',
    websitesi: contact.website ?? '',

    iadeTable: [],
    ozelMatrahTutari: formatMinor(toMinor(specialBase.amount ?? 0)),
    ozelMatrahOrani: specialBase.rate ?? 0,
    ozelMatrahVergiTutari: formatMinor(toMinor(specialBase.taxAmount ?? 0)),
    vergiCesidi: specialBase.taxType ?? ' ',

    malHizmetTable: lines.map((line) => ({
      malHizmet: line.name,
      miktar: line.quantity,
      birim: line.unit,
      birimFiyat: formatMinor(toMinor(line.unitPrice)),
      fiyat: formatMinor(toMinor(line.grossAmount)),
      iskontoOrani: line.discountRate ?? 0,
      iskontoTutari: formatMinor(toMinor(line.discountAmount)),
      iskontoNedeni: line.discountReason ?? '',
      malHizmetTutari: formatMinor(toMinor(line.netAmount)),
      kdvOrani: line.vatRate,
      kdvTutari: formatMinor(toMinor(line.vatAmount)),
      vergiOrani: line.additionalTaxRate ?? 0,
      vergininKdvTutari: formatMinor(toMinor(line.additionalTaxAmount)),
      ozelMatrahTutari: formatMinor(0),
    })),

    tip: 'İskonto',
    matrah: formatMinor(toMinor(totals.taxBase)),
    malhizmetToplamTutari: formatMinor(toMinor(totals.lineTotal)),
    toplamIskonto: formatMinor(toMinor(totals.totalDiscount)),
    hesaplanankdv: formatMinor(toMinor(totals.calculatedVat)),
    vergilerToplami: formatMinor(toMinor(totals.totalTaxes)),
    vergilerDahilToplamTutar: formatMinor(toMinor(totals.grandTotal)),
    odenecekTutar: formatMinor(toMinor(totals.payableAmount)),

    not: input.note ?? '',
    siparisNumarasi: input.orderNumber ?? '',
    siparisTarihi: input.orderDate === undefined ? '' : formatPortalDate(input.orderDate),
    irsaliyeNumarasi: input.waybillNumber ?? '',
    irsaliyeTarihi: input.waybillDate === undefined ? '' : formatPortalDate(input.waybillDate),
    fisNo: receipt.number ?? '',
    fisTarihi: receipt.date === undefined ? '' : formatPortalDate(receipt.date),
    fisSaati: receipt.time ?? ' ',
    fisTipi: receipt.type ?? ' ',
    zRaporNo: receipt.zReportNumber ?? '',
    okcSeriNo: receipt.cashRegisterSerialNumber ?? '',
  }
}

/**
 * Bir tarih alanını normalize eder; ayrıştırılamazsa ham stringi geri verir.
 * `str()` yalnızca alan STRING DEĞİLSE varsayılana düşer — boş string ('')
 * geçerli bir string olduğu için varsayılanı tetiklemez ve doğrudan
 * `formatPortalDate('')`'a gider, ki bu fırlatır (bkz. I5). Tek bir bozuk
 * alanın çağıranı düşürmemesi için bu fırlatma burada yutulur.
 *
 * Hem `toInvoiceSummary` (liste satırları) hem `InvoiceService.getInvoice`
 * (tekil detay — round 2 madde 3: aynı `str()` kör noktası okuma yolunda da
 * vardı, `input.date` boş geldiğinde `formatPortalDate(input.date)`
 * fırlatıyor ve çağıran `detail.raw`'a bile erişemiyordu) tarafından
 * paylaşılır.
 */
export function normalizePortalDate(raw: unknown): string {
  const rawDate = str(raw, formatPortalDate())
  try {
    return formatPortalDate(rawDate)
  } catch {
    return rawDate
  }
}

/**
 * Taslak listesi satırını normalize eder. Portal bu listede tarihi tire ile
 * döndürüyor (`03-09-2026`) ancak fatura yükünde eğik çizgi bekliyor.
 *
 * Tek bir satırın alanı bozuksa (ör. ayrıştırılamayan tarih) bu fonksiyon
 * FIRLATMAZ — bkz. `normalizePortalDate`. Aksi halde `listDrafts` gibi bir
 * toplu listeleme, paylaşılan test kullanıcı havuzundaki YABANCI tek bir
 * kayıt yüzünden tamamen başarısız olurdu (bkz. I5; `createDraft` içindeki
 * ikinci `listDrafts` çağrısı özellikle risklidir: ETTN çözümü bu listeye
 * bağlıdır).
 */
export function toInvoiceSummary(raw: Record<string, unknown>): InvoiceSummary {
  return {
    ettn: str(raw.ettn),
    documentNumber: str(raw.belgeNumarasi),
    buyerTaxOrIdentityNumber: str(raw.aliciVknTckn),
    buyerName: str(raw.aliciUnvanAdSoyad),
    date: normalizePortalDate(raw.belgeTarihi),
    documentType: str(raw.belgeTuru, DocumentType.INVOICE) as DocumentTypeCode,
    approvalStatus: str(raw.onayDurumu, ApprovalStatus.NOT_APPROVED) as ApprovalStatusValue,
  }
}

function toLineItemInput(raw: unknown): LineItemInput {
  const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    name: str(row.malHizmet),
    quantity: num(row.miktar, 1),
    unit: str(row.birim, 'C62') as LineItemInput['unit'],
    unitPrice: num(row.birimFiyat),
    discountRate: num(row.iskontoOrani),
    discountReason: str(row.iskontoNedeni),
    vatRate: num(row.kdvOrani),
    additionalTaxRate: num(row.vergiOrani),
  }
}

/**
 * Portalın Türkçe alan adlarıyla hazırlanmış ham nesneyi `InvoiceInput`'a
 * çevirir. PHP projesindeki `mapWithTurkishKeys` işlevinin karşılığıdır.
 */
export function fromPortalPayload(raw: Record<string, unknown>): InvoiceInput {
  const table = Array.isArray(raw.malHizmetTable) ? raw.malHizmetTable : []

  return {
    documentNumber: str(raw.belgeNumarasi),
    date: str(raw.faturaTarihi, formatPortalDate()),
    time: str(raw.saat, formatPortalTime()),
    currency: str(raw.paraBirimi, Currency.TURKISH_LIRA) as CurrencyCode,
    currencyRate: num(raw.dovzTLkur),
    invoiceType: str(raw.faturaTipi, InvoiceType.SALE) as InvoiceTypeCode,
    buyer: {
      taxOrIdentityNumber: str(raw.vknTckn),
      title: str(raw.aliciUnvan),
      firstName: str(raw.aliciAdi),
      lastName: str(raw.aliciSoyadi),
      taxOffice: str(raw.vergiDairesi),
      address: {
        country: str(raw.ulke, Country.TURKIYE),
        city: str(raw.sehir),
        district: str(raw.mahalleSemtIlce),
        street: str(raw.bulvarcaddesokak),
        buildingName: str(raw.binaAdi),
        buildingNumber: str(raw.binaNo),
        doorNumber: str(raw.kapiNo),
        town: str(raw.kasabaKoy),
        postalCode: str(raw.postaKodu),
      },
      contact: {
        phone: str(raw.tel),
        fax: str(raw.fax),
        email: str(raw.eposta),
        website: str(raw.websitesi),
      },
    },
    lineItems: table.map(toLineItemInput),
    note: str(raw.not),
    orderNumber: str(raw.siparisNumarasi),
    waybillNumber: str(raw.irsaliyeNumarasi),
  }
}

/**
 * `getInvoice` için fatura toplamlarını PORTALIN KENDİ yanıtından okur.
 *
 * Eski davranış toplamları her zaman kalemlerden yeniden hesaplıyordu — bu,
 * bu kütüphanenin aritmetiğini GİB'in tuttuğu resmi rakamların yerine
 * koyuyordu (bkz. I4). Bir alan portal yanıtında YOKSA (ör. eski bir
 * fikstürde) `computed` düşüşü kullanılır; alan varsa değeri ne olursa
 * olsun (Türkçe ondalık biçimiyle) `num()` ile ayrıştırılıp aynen aktarılır.
 * `additionalTaxes` portalda ayrı bir alan olarak gelmiyor (bkz.
 * `InvoiceTotals.additionalTaxes` belgesi), bu yüzden her zaman hesaplanır.
 */
export function portalTotals(raw: Record<string, unknown>, computed: InvoiceTotals): InvoiceTotals {
  const pick = (key: string, fallback: number): number =>
    raw[key] === undefined ? fallback : num(raw[key], fallback)

  return {
    lineTotal: pick('malhizmetToplamTutari', computed.lineTotal),
    totalDiscount: pick('toplamIskonto', computed.totalDiscount),
    taxBase: pick('matrah', computed.taxBase),
    calculatedVat: pick('hesaplanankdv', computed.calculatedVat),
    additionalTaxes: computed.additionalTaxes,
    totalTaxes: pick('vergilerToplami', computed.totalTaxes),
    grandTotal: pick('vergilerDahilToplamTutar', computed.grandTotal),
    payableAmount: pick('odenecekTutar', computed.payableAmount),
  }
}
