import type {
  ApprovalStatusValue,
  CurrencyCode,
  DocumentTypeCode,
  InvoiceListKindValue,
  InvoiceTypeCode,
  UnitCode,
} from '../../constants/index.js'
import type { DateInput } from '../../core/index.js'
import type { AddressInput, CreatedDocument, DocumentSummary } from '../../documents/index.js'

/**
 * Adres girdisi `documents` yaprak katmanına taşındı (serbest meslek
 * makbuzu da aynı alanları taşıyor); adı geriye dönük uyumluluk için
 * buradan yeniden dışa açılıyor.
 */
export type { AddressInput }

/**
 * Alıcının iletişim bilgileri. Dördü de opsiyoneldir; verilmeyen alan portala
 * boş string olarak gider ve belgede görünmez.
 *
 * @example
 * ```ts
 * import type { ContactInput } from '@yankikucuk/efatura'
 *
 * const contact: ContactInput = {
 *   phone: '02161234567',
 *   email: 'muhasebe@ornek.test',
 *   website: 'https://ornek.test',
 * }
 * console.log(contact.email)
 * ```
 */
export interface ContactInput {
  /** Portal `tel` alanı. Serbest metin; portal biçim doğrulaması yapmaz. */
  phone?: string
  /** Portal `fax` alanı. */
  fax?: string
  /** Portal `eposta` alanı — faturanın e-posta ile iletileceği adres. */
  email?: string
  /** Portal `websitesi` alanı. */
  website?: string
}

/**
 * Faturanın kesildiği alıcı.
 *
 * `taxOrIdentityNumber` zorunludur; ayrıca ya `title` (tüzel kişi) ya da
 * `firstName`/`lastName` (gerçek kişi) verilmelidir — ikisi de boşsa
 * doğrulama başarısız olur. Nihai tüketiciye kesilen faturalarda TCKN alanına
 * genellikle `'11111111111'` yazılır.
 *
 * @example Tüzel kişi
 * ```ts
 * import type { BuyerInput } from '@yankikucuk/efatura'
 *
 * const buyer: BuyerInput = {
 *   taxOrIdentityNumber: '1111111111',
 *   title: 'ÖRNEK YAZILIM A.Ş.',
 *   taxOffice: 'Kadıköy',
 * }
 * console.log(buyer.title)
 * ```
 *
 * @example Gerçek kişi ve adres
 * ```ts
 * import { Country } from '@yankikucuk/efatura'
 * import type { BuyerInput } from '@yankikucuk/efatura'
 *
 * const buyer: BuyerInput = {
 *   taxOrIdentityNumber: '11111111111',
 *   firstName: 'Ali',
 *   lastName: 'Yılmaz',
 *   address: { country: Country.TURKIYE, city: 'İstanbul', district: 'Maltepe' },
 *   contact: { email: 'ali@ornek.test' },
 * }
 * console.log(buyer.address?.city)
 * ```
 */
export interface BuyerInput {
  /** VKN (10 hane) veya TCKN (11 hane). Yalnızca rakam; portal `vknTckn` alanı. */
  taxOrIdentityNumber: string
  /** Tüzel kişi ünvanı. Gerçek kişide firstName/lastName kullanılır. */
  title?: string
  /** Gerçek kişinin adı; portal `aliciAdi` alanı. */
  firstName?: string
  /** Gerçek kişinin soyadı; portal `aliciSoyadi` alanı. */
  lastName?: string
  /** Bağlı olunan vergi dairesi; portal `vergiDairesi` alanı. */
  taxOffice?: string
  /** Adres alanları; verilmeyen her alan boş gider, `country` varsayılan `'Türkiye'`. */
  address?: AddressInput
  /** Telefon, faks, e-posta ve web sitesi. */
  contact?: ContactInput
}

/**
 * Bir fatura kalemi. Tutarlar bu alanlardan HESAPLANIR; kalem tutarı ayrıca
 * verilmez.
 *
 * Hesap sırası: brüt = miktar × birim fiyat → iskonto = brüt × iskonto oranı →
 * net = brüt − iskonto → KDV = net × KDV oranı → ek vergi = net × ek vergi
 * oranı. Her adım tam sayı kuruş üzerinde ayrı ayrı yuvarlanır.
 *
 * @example
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { LineItemInput } from '@yankikucuk/efatura'
 *
 * const item: LineItemInput = {
 *   name: 'Danışmanlık',
 *   quantity: 4,
 *   unit: Unit.HOUR,
 *   unitPrice: 500,
 *   vatRate: 20,
 *   discountRate: 10,
 *   discountReason: 'Kampanya',
 * }
 * console.log(item.name)
 * ```
 */
export interface LineItemInput {
  /** Mal veya hizmetin adı; portal `malHizmet` alanı. Boş olamaz. */
  name: string
  /** Miktar; portal `miktar` alanı. Pozitif olmalı, ondalık olabilir. */
  quantity: number
  /** UN/ECE Recommendation 20 birim kodu; portal `birim` alanı. Bkz. `Unit`. */
  unit: UnitCode
  /** Birim fiyat, LİRA cinsinden; portal `birimFiyat` alanı. Negatif olamaz. */
  unitPrice: number
  /** Yüzde, 0–100. */
  discountRate?: number
  /** İskonto nedeni; portal `iskontoNedeni` alanı. Yalnızca metin. */
  discountReason?: string
  /** Yüzde, 0–100. Ör. 20, 10, 1, 0. */
  vatRate: number
  /** Yüzde, 0–100. Portal `vergiOrani` alanı. */
  additionalTaxRate?: number
}

/**
 * Ödeme kaydedici cihaz (yazar kasa) fişi bilgileri. Tümü opsiyoneldir;
 * yalnızca fişe dayalı fatura düzenlerken doldurulur.
 *
 * @example
 * ```ts
 * import type { ReceiptInput } from '@yankikucuk/efatura'
 *
 * const receipt: ReceiptInput = {
 *   number: '0042',
 *   date: '05/09/2026',
 *   time: '14:35:00',
 *   zReportNumber: '0007',
 *   cashRegisterSerialNumber: 'TR12345678',
 * }
 * console.log(receipt.number)
 * ```
 */
export interface ReceiptInput {
  /** Fiş numarası; portal `fisNo` alanı. */
  number?: string
  /** Fiş tarihi; `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd` metni. */
  date?: DateInput
  /** Fiş saati, `HH:mm:ss` biçiminde METİN; portal `fisSaati` alanı. */
  time?: string
  /** Fiş tipi; portal `fisTipi` alanı. */
  type?: string
  /** Z raporu numarası; portal `zRaporNo` alanı. */
  zReportNumber?: string
  /** Ödeme kaydedici cihaz seri numarası; portal `okcSeriNo` alanı. */
  cashRegisterSerialNumber?: string
}

/**
 * Özel matrah alanları — `faturaTipi: 'OZELMATRAH'` faturalarında kullanılır.
 *
 * DİKKAT: bu alanlar toplam hesabına GİRMEZ; portala olduğu gibi iletilir.
 * Aşağı akışta başka hiçbir koruma olmadığı için doğrulama tek güvencedir.
 *
 * @example
 * ```ts
 * import { InvoiceType } from '@yankikucuk/efatura'
 * import type { SpecialBaseInput } from '@yankikucuk/efatura'
 *
 * const specialBase: SpecialBaseInput = {
 *   amount: 1_000,
 *   rate: 20,
 *   taxAmount: 200,
 *   taxType: 'ÖİV',
 * }
 * console.log(InvoiceType.SPECIAL_BASE, specialBase.amount)
 * ```
 */
export interface SpecialBaseInput {
  /** Özel matrah tutarı, LİRA; portal `ozelMatrahTutari` alanı. Negatif olamaz. */
  amount?: number
  /** Yüzde, 0–100. */
  rate?: number
  /** Özel matrah vergi tutarı, LİRA; portal `ozelMatrahVergiTutari` alanı. */
  taxAmount?: number
  /** Vergi çeşidi; portal `vergiCesidi` alanı. Verilmezse tek boşluk gönderilir. */
  taxType?: string
}

/**
 * Tutarların tamamı lira cinsindendir; kuruş dönüşümü mapper içinde yapılır.
 *
 * `createDraft` girdisinde `totals` KISMİ olarak verilebilir: verilen alanlar
 * hesaplananın üzerine yazılır ve şu eşitlikler doğrulanır —
 * `taxBase = lineTotal − totalDiscount`,
 * `totalTaxes = calculatedVat + additionalTaxes`,
 * `grandTotal = taxBase + totalTaxes`, `payableAmount = grandTotal`.
 * Eşitliklerden biri bozulursa istek ağa çıkmadan reddedilir.
 *
 * @example Hesaplananı okumak
 * ```ts
 * import { computeTotals, Unit } from '@yankikucuk/efatura'
 * import type { InvoiceTotals } from '@yankikucuk/efatura'
 *
 * const { totals }: { totals: InvoiceTotals } = computeTotals([
 *   { name: 'Hizmet', quantity: 2, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 },
 * ])
 * console.log(totals.taxBase, totals.calculatedVat, totals.grandTotal)
 * ```
 */
export interface InvoiceTotals {
  /** `malhizmetToplamTutari` — iskonto öncesi kalem toplamı. */
  lineTotal: number
  /** `toplamIskonto` */
  totalDiscount: number
  /** `matrah` — iskonto sonrası vergi matrahı. */
  taxBase: number
  /** `hesaplanankdv` */
  calculatedVat: number
  /**
   * `vergilerToplami` içindeki KDV dışı vergiler.
   *
   * Portal bu alanı ayrı taşımıyor; modelde tutuluyor çünkü onsuz
   * `totalTaxes` iki bilinmeyenli tek denklem olur ve `calculatedVat`
   * override'ı hiçbir eşitlikle doğrulanamazdı.
   */
  additionalTaxes: number
  /** `vergilerToplami` — KDV ve varsa ek vergiler. */
  totalTaxes: number
  /** `vergilerDahilToplamTutar` */
  grandTotal: number
  /** `odenecekTutar` */
  payableAmount: number
}

/**
 * Bir kalemin hesaplanmış tutarları.
 *
 * Girdi alanlarının tamamını taşır; üzerine hesaplanan beş tutarı ekler. Tüm
 * tutarlar LİRA cinsindendir ve kuruşa yuvarlanmıştır.
 *
 * @example
 * ```ts
 * import { computeLineItem, Unit } from '@yankikucuk/efatura'
 *
 * const line = computeLineItem({
 *   name: 'Danışmanlık',
 *   quantity: 4,
 *   unit: Unit.HOUR,
 *   unitPrice: 500,
 *   vatRate: 20,
 *   discountRate: 10,
 * })
 * console.log(line.grossAmount, line.discountAmount, line.netAmount, line.vatAmount)
 * ```
 */
export interface ComputedLineItem extends LineItemInput {
  /** `fiyat` — miktar × birim fiyat, iskonto öncesi. */
  grossAmount: number
  /** `iskontoTutari` */
  discountAmount: number
  /** `malHizmetTutari` — iskonto sonrası. */
  netAmount: number
  /** `kdvTutari` */
  vatAmount: number
  /** `vergininKdvTutari` */
  additionalTaxAmount: number
}

/**
 * `createDraft` girdisi.
 *
 * Zorunlu olan yalnızca `buyer` ve en az bir `lineItems` kalemidir; kalan her
 * alan opsiyoneldir ve verilmezse portala boş ya da varsayılan değerle gider.
 * Tüm tutarlar LİRA cinsindendir.
 *
 * @example En az girdiyle
 * ```ts
 * import { Unit } from '@yankikucuk/efatura'
 * import type { InvoiceInput } from '@yankikucuk/efatura'
 *
 * const input: InvoiceInput = {
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 250, vatRate: 20 }],
 * }
 * console.log(input.lineItems.length)
 * ```
 *
 * @example Dövizli fatura — `currencyRate` zorunlu
 * ```ts
 * import { Currency, Unit } from '@yankikucuk/efatura'
 * import type { InvoiceInput } from '@yankikucuk/efatura'
 *
 * const input: InvoiceInput = {
 *   currency: Currency.EURO,
 *   currencyRate: 37.42,
 *   buyer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK GMBH' },
 *   lineItems: [{ name: 'Lisans', quantity: 1, unit: Unit.PIECE, unitPrice: 1_000, vatRate: 0 }],
 * }
 * console.log(input.currencyRate)
 * ```
 */
export interface InvoiceInput {
  /** Belge numarası; portal `belgeNumarasi` alanı. Verilmezse portal atar. */
  documentNumber?: string
  /** Belge tarihi; `Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd` metni. Varsayılan bugün. */
  date?: DateInput
  /**
   * Belge saati. `Date` verilirse saat/dakika/saniyesi kullanılır; metin
   * verilirse `HH:mm:ss` biçiminde OLMALIDIR. Varsayılan şu an.
   */
  time?: DateInput
  /** ISO 4217 kodu; portal `paraBirimi` alanı. Varsayılan `'TRY'`. */
  currency?: CurrencyCode
  /** TRY dışı para birimlerinde zorunlu. */
  currencyRate?: number
  /** Portal `faturaTipi` alanı. Varsayılan `'SATIS'`. */
  invoiceType?: InvoiceTypeCode
  /** Alıcı bilgileri; zorunlu. */
  buyer: BuyerInput
  /** En az bir kalem; boş dizi doğrulamada reddedilir. */
  lineItems: LineItemInput[]
  /** Verilirse hesaplanan değerlerin üzerine yazılır ve tutarlılık doğrulanır. */
  totals?: Partial<InvoiceTotals>
  /** Fatura notu; portal `not` alanı. */
  note?: string
  /** Sipariş numarası; portal `siparisNumarasi` alanı. */
  orderNumber?: string
  /** Sipariş tarihi; verilmezse portala boş gider (bugüne DÜŞMEZ). */
  orderDate?: DateInput
  /** İrsaliye numarası; portal `irsaliyeNumarasi` alanı. */
  waybillNumber?: string
  /** İrsaliye tarihi; verilmezse portala boş gider. */
  waybillDate?: DateInput
  /** Ödeme kaydedici cihaz fişi bilgileri. */
  receipt?: ReceiptInput
  /** Özel matrah alanları; yalnızca `invoiceType: 'OZELMATRAH'` ile anlamlıdır. */
  specialBase?: SpecialBaseInput
}

/**
 * Taslak listesinin bir satırı.
 *
 * `DocumentSummary` olarak `src/documents/`'a taşındı (portal-belge-geneli:
 * yalnızca faturaya özgü değil). Bu takma ad geriye dönük uyumluluk için
 * korunuyor — `InvoiceSummary` public API'nin bir parçası (bkz. `src/index.ts`).
 *
 * Alanlar: `ettn`, `documentNumber`, `buyerTaxOrIdentityNumber`, `buyerName`,
 * `dd/MM/yyyy` biçiminde `date`, `documentType` ve `approvalStatus`.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { InvoiceSummary } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows: InvoiceSummary[] = await client.listDrafts(new Date(), new Date())
 * console.log(rows.map((row) => `${row.ettn} ${row.documentType}`))
 * ```
 */
export type InvoiceSummary = DocumentSummary

/**
 * `EARSIV_PORTAL_FATURA_GETIR` sonucu.
 *
 * Toplamlar öncelikle portalın kendi yanıtından okunur; alan yanıtta hiç
 * yoksa kalemlerden hesaplanana düşülür. Eşlemede kapsanmayan her alana
 * `raw` üzerinden erişilebilir.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { InvoiceDetail } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const detail: InvoiceDetail = await client.getInvoice('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * console.log(detail.currency, detail.totals.grandTotal, detail.raw.faturaTipi)
 * ```
 */
export interface InvoiceDetail {
  /** İstenen ETTN; portal yanıtı ne döndürürse döndürsün bu değer korunur. */
  ettn: string
  /** Portal `belgeNumarasi` alanı; yoksa boş string. */
  documentNumber: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi; ayrıştırılamazsa ham değer. */
  date: string
  /** `HH:mm:ss` biçiminde belge saati; portal vermezse boş string. */
  time: string
  /** ISO 4217 kodu; portal vermezse `'TRY'`. */
  currency: string
  /** Döviz kuru; portal vermezse 0. */
  currencyRate: number
  /** Portal `faturaTipi` alanı; yoksa `'SATIS'`. */
  invoiceType: string
  /** Portal yanıtından eşlenmiş alıcı bilgileri. */
  buyer: BuyerInput
  /** Kalemler; türetilmiş tutarlar oranlardan yeniden hesaplanır. */
  lineItems: ComputedLineItem[]
  /** Belge düzeyi toplamlar; öncelik portalın kendi rakamlarındadır. */
  totals: InvoiceTotals
  /** Portal `not` alanı; yoksa boş string. */
  note: string
  /** Portalın ham yanıtı — eşlemede kaybolan alanlara erişim için. */
  raw: Record<string, unknown>
}

/**
 * `createDraft` sonucu.
 *
 * `CreatedDocument` olarak `documents` katmanına taşındı — fatura ve her iki
 * makbuz türü aynı şekli döndürüyor. Bu takma ad public API'nin parçası
 * olarak korunuyor.
 *
 * Alanlar: `ettn`, `documentNumber`, `date` (`dd/MM/yyyy`) ve
 * `approvalStatus`.
 *
 * @example
 * ```ts
 * import { ApprovalStatus, EArsivClient, Unit } from '@yankikucuk/efatura'
 * import type { CreatedInvoice } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created: CreatedInvoice = await client.createDraft({
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 * })
 * console.log(created.approvalStatus === ApprovalStatus.NOT_APPROVED)
 * ```
 */
export type CreatedInvoice = CreatedDocument

/**
 * `listDrafts` seçenekleri.
 *
 * @example
 * ```ts
 * import { EArsivClient, InvoiceListKind } from '@yankikucuk/efatura'
 * import type { ListOptions } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const options: ListOptions = { kind: InvoiceListKind.STANDARD }
 * const all = await client.listDrafts(new Date(), new Date(), options)
 * console.log(all.length)
 * ```
 */
export interface ListOptions {
  /**
   * Varsayılan `InvoiceListKind.INTERACTIVE`.
   *
   * `INTERACTIVE` (`'5000/30000'`) YALNIZCA faturaları döndürür.
   * `STANDARD` (`'Buyuk'`) bir belge türü FİLTRESİ DEĞİL, bir ÜST KÜMEDİR:
   * fatura ve her iki makbuz türü aynı listede gelir (canlı doğrulandı
   * 2026-09-05). Türü ayırt etmek için satırların `documentType` alanına
   * bakın.
   */
  kind?: InvoiceListKindValue
}

/**
 * `listIncomingExternal` filtreleri — portalın kendi ekranında üçü de
 * opsiyoneldir; boş bırakılan alan "filtre yok" anlamına gelir.
 *
 * @example
 * ```ts
 * import { DocumentType } from '@yankikucuk/efatura'
 * import type { ListIncomingExternalFilters } from '@yankikucuk/efatura'
 *
 * const filters: ListIncomingExternalFilters = {
 *   sellerTaxOrIdentityNumber: '1111111111',
 *   documentType: DocumentType.INVOICE,
 * }
 * console.log(filters.documentType)
 * ```
 */
export interface ListIncomingExternalFilters {
  /** Belgeyi düzenleyen satıcının VKN/TCKN'i; portal `saticiVknTckn` filtresi. */
  sellerTaxOrIdentityNumber?: string
  /** Belge türü; portal `belgeTuru` filtresi. */
  documentType?: DocumentTypeCode
  /** Entegratörün verdiği fatura numarası; portal `faturaNo` filtresi. */
  invoiceNumber?: string
}

/**
 * "Portal Harici Adıma Düzenlenen Belgeler" satırı — bir ENTEGRATÖR
 * aracılığıyla adınıza düzenlenmiş belge. `InvoiceSummary`'den farklı: satıcı
 * kimliği taşır (bu listede siz her zaman alıcısınız) ve entegratörün verdiği
 * ayrı bir fatura numarası (`invoiceNumber`) içerir.
 *
 * NOT: alan adları portalın filtre alanlarıyla (`saticiVknTckn`, `belgeTuru`,
 * `faturaNo`) ve diğer belge listelerindeki (`belgeNumarasi`, `belgeTarihi`,
 * `onayDurumu`) tutarlı adlandırma kuralından çıkarıldı; canlı test
 * ortamındaki paylaşımlı test kullanıcısında gerçek bir entegratör kaydı
 * gözlemlenemedi (bkz. rapor). Gerçek bir yanıt görüldüğünde bu tip ve
 * mapper'ı buna göre doğrulayın/düzeltin.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { IncomingExternalSummary } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows: IncomingExternalSummary[] = await client.listIncomingExternal(
 *   '01/09/2026',
 *   '30/09/2026',
 * )
 * for (const row of rows) console.log(row.sellerTaxOrIdentityNumber, row.invoiceNumber)
 * ```
 */
export interface IncomingExternalSummary {
  /** Belgenin ETTN'i. */
  ettn: string
  /** Portalın belge numarası; portal `belgeNumarasi` alanı. */
  documentNumber: string
  /** Entegratörün verdiği fatura numarası — `belgeNumarasi`'ndan ayrı. */
  invoiceNumber: string
  /** Belgeyi düzenleyen satıcının VKN/TCKN'i. */
  sellerTaxOrIdentityNumber: string
  /** Satıcının ünvanı veya ad/soyadı. */
  sellerName: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi. */
  date: string
  /** Belge türü; portal vermezse `'FATURA'`. */
  documentType: DocumentTypeCode
  /** Onay durumu; portal vermezse `'Onaylanmadı'`. */
  approvalStatus: ApprovalStatusValue
}

/**
 * `cancelDraft` seçenekleri.
 *
 * @example
 * ```ts
 * import type { CancelDraftOptions } from '@yankikucuk/efatura'
 *
 * // Dünkü bir taslağı hedeflemek için arama tarihini açıkça verin.
 * const options: CancelDraftOptions = { date: '04/09/2026' }
 * console.log(options.date)
 * ```
 */
export interface CancelDraftOptions {
  /**
   * Taslağın aranacağı tarih. Varsayılan: bugün.
   *
   * Eski davranış aramayı her zaman bugüne sabitliyordu; dünkü (veya daha
   * eski) bir taslak bu API üzerinden asla silinemiyordu (bkz. I10).
   */
  date?: DateInput
}
