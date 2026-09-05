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
import { normalizeSummaryDate, num, str } from '../../documents/index.js'

import { computeTotals, mergeAndVerifyTotals } from './invoice.totals.js'
import type {
  IncomingExternalSummary,
  InvoiceInput,
  InvoiceTotals,
  LineItemInput,
} from './invoice.types.js'

/**
 * Fatura girdisini portalın beklediği Türkçe anahtarlı yüke çevirir.
 *
 * `faturaUuid` bilinçli olarak YOKTUR: güncel portal istemci tarafından
 * verilen ETTN'i reddediyor ve kendisi atıyor (spec §2.3).
 *
 * Tutarlar burada LİRADAN KURUŞA çevrilir ve portalın beklediği iki
 * ondalıklı, NOKTA ayırıcılı metin biçimine (`'120.00'`) getirilir.
 *
 * @param input Fatura girdisi. Toplamlar kalemlerden hesaplanır; `totals`
 *   verilmişse üzerine yazılır ve eşitlikler doğrulanır.
 * @returns Portalın Türkçe anahtarlı yükü — `jp` alanına
 *   `JSON.stringify` ile yazılmaya hazır.
 * @throws {EArsivValidationError} Kalemler boşsa, bir kalem geçersizse ya da
 *   `totals` override'ı tutarsızsa.
 *
 * @example
 * ```ts
 * import { toPortalInvoice, Unit } from 'efatura'
 *
 * const payload = toPortalInvoice({
 *   date: '05/09/2026',
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 * })
 * console.log(payload.faturaTarihi, payload.vergilerDahilToplamTutar)
 * // '05/09/2026' '120.00'
 * ```
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
 * Entegratör (portal harici) adıma düzenlenen belge satırını eşler.
 *
 * `toDocumentSummary` (bkz. `src/documents/`)'dan BİLİNÇLİ olarak ayrı: bu
 * listede siz her zaman alıcısınız, bu yüzden portalın filtre alanıyla
 * (`saticiVknTckn`) tutarlı olarak satıcı kimliği taşınır —
 * `aliciVknTckn`/`aliciUnvanAdSoyad` değil. Entegratörün kendi fatura
 * numarası (`faturaNo`) da portalın belge numarasından (`belgeNumarasi`)
 * ayrı bir alan olarak taşınır.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz —
 * `InvoiceService.listIncomingExternal` bunu zaten uygular.
 *
 * @param raw Entegratör liste yanıtının bir satırı.
 * @returns Eşlenmiş satır; eksik alanlar boş stringe, `belgeTuru` `'FATURA'`,
 *   `onayDurumu` `'Onaylanmadı'` varsayılanlarına düşer.
 *
 * @example Girdi ve çıktı
 * ```text
 * { saticiVknTckn: '1111111111', faturaNo: 'ABC2026000000001', belgeTarihi: '03-09-2026' }
 *   -> { sellerTaxOrIdentityNumber: '1111111111', invoiceNumber: 'ABC2026000000001',
 *        date: '03/09/2026', documentType: 'FATURA', approvalStatus: 'Onaylanmadı', ... }
 * ```
 */
export function toIncomingExternalSummary(raw: Record<string, unknown>): IncomingExternalSummary {
  return {
    ettn: str(raw.ettn),
    documentNumber: str(raw.belgeNumarasi),
    invoiceNumber: str(raw.faturaNo),
    sellerTaxOrIdentityNumber: str(raw.saticiVknTckn),
    sellerName: str(raw.saticiUnvanAdSoyad),
    date: normalizeSummaryDate(raw.belgeTarihi),
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
 *
 * Okuma yönünde çalışır ve HİÇBİR doğrulama yapmaz; eksik ya da beklenmedik
 * tipteki her alan güvenli bir varsayılana düşer.
 *
 * @param raw `EARSIV_PORTAL_FATURA_GETIR` yanıtının `data` alanı.
 * @returns `InvoiceInput` şeklinde eşlenmiş girdi. DİKKAT: `date`/`time`
 *   alanları portal boş döndürdüğünde BOŞ STRING kalır — bu değeri doğrudan
 *   `formatPortalDate`'e vermeyin.
 *
 * @example
 * ```ts
 * import { fromPortalPayload } from 'efatura'
 *
 * const input = fromPortalPayload({
 *   belgeNumarasi: 'EAR2026000000123',
 *   vknTckn: '11111111111',
 *   aliciUnvan: 'ÖRNEK A.Ş.',
 *   malHizmetTable: [{ malHizmet: 'Hizmet', miktar: 1, birimFiyat: '100.00', kdvOrani: 20 }],
 * })
 * console.log(input.buyer.title, input.lineItems[0]?.unitPrice)
 * ```
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
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz.
 *
 * @param raw Portalın detay yanıtı; toplam alanları burada aranır.
 * @param computed Kalemlerden hesaplanmış toplamlar — YALNIZCA ilgili alan
 *   yanıtta HİÇ YOKSA kullanılır.
 * @returns Sekiz alanlı toplamlar; `additionalTaxes` her zaman `computed`'ten
 *   gelir.
 *
 * @example Girdi ve çıktı
 * ```text
 * portalTotals({ matrah: '1.234,56' }, hesaplanan)
 *   -> taxBase = 1234.56 (portalın rakamı), diğer alanlar hesaplanandan
 * ```
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
