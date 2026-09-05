import type { ApprovalStatusValue, CountryName, DocumentTypeCode } from '../constants/index.js'

/**
 * Taslak listesinin bir satırı.
 *
 * `invoice` modülünden buraya taşındı (`InvoiceSummary` olarak): herhangi bir
 * portal belge tipini (fatura, müstahsil makbuzu, serbest meslek makbuzu)
 * tanımlar, yalnızca faturaya özgü değildir — `EARSIV_PORTAL_TASLAKLARI_GETIR`
 * hepsini aynı satır biçiminde döndürür, tipi `documentType` ayırt eder.
 *
 * Paket kökünden `InvoiceSummary`, `ProducerReceiptSummary` ve
 * `SelfEmployedReceiptSummary` adlarıyla dışa açılır — üçü de bu tipin takma
 * adıdır.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { InvoiceSummary } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const rows: InvoiceSummary[] = await client.listDrafts(new Date(), new Date())
 * for (const row of rows) {
 *   console.log(row.ettn, row.documentNumber, row.date, row.documentType, row.approvalStatus)
 * }
 * ```
 */
export interface DocumentSummary {
  /** Belgenin ETTN'i; detay ve gösterim çağrılarında birebir bu değer kullanılır. */
  ettn: string
  /** Portal `belgeNumarasi` alanı; yoksa boş string. */
  documentNumber: string
  /** Portal `aliciVknTckn` alanı; yoksa boş string. */
  buyerTaxOrIdentityNumber: string
  /**
   * Portal `aliciUnvanAdSoyad` alanı; yoksa boş string.
   *
   * DİKKAT: müstahsil makbuzu satırlarında portal bu alanı HİÇ göndermiyor
   * (canlı doğrulandı), serbest meslek makbuzunda ise değer `adi` + `soyadi`
   * birleşimidir — `unvan` DEĞİL.
   */
  buyerName: string
  /** `dd/MM/yyyy` biçimine normalize edilmiş belge tarihi. */
  date: string
  /** Belge türü; portal vermezse `'FATURA'`. */
  documentType: DocumentTypeCode
  /** Onay durumu; portal vermezse `'Onaylanmadı'`. */
  approvalStatus: ApprovalStatusValue
}

/**
 * Bir belge oluşturma işleminin sonucu.
 *
 * Fatura ve her iki makbuz türü de AYNI şekli döndürüyor: portal oluşturma
 * yanıtında yalnızca bir durum cümlesi veriyor, kimlik bilgisi anlık
 * görüntü farkıyla listeden çözülüyor (bkz. `resolveCreatedEttn`). Kardeş
 * modüller birbirini import edemediği için tip burada, yaprak katmanda
 * duruyor; `CreatedInvoice` bunun takma adıdır.
 *
 * Paket kökünden `CreatedInvoice`, `CreatedProducerReceipt` ve
 * `CreatedSelfEmployedReceipt` adlarıyla dışa açılır.
 *
 * @example
 * ```ts
 * import { EArsivClient, Unit } from 'efatura'
 * import type { CreatedInvoice } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created: CreatedInvoice = await client.createDraft({
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
 * })
 * console.log(created.ettn, created.documentNumber, created.date, created.approvalStatus)
 * ```
 */
export interface CreatedDocument {
  /** Anlık görüntü farkıyla çözülmüş ETTN — portal bunu yanıtta döndürmez. */
  ettn: string
  /** Portalın atadığı belge numarası. */
  documentNumber: string
  /** `dd/MM/yyyy` biçiminde belge tarihi. */
  date: string
  /** Yeni oluşturulan belge her zaman taslaktır: `'Onaylanmadı'`. */
  approvalStatus: ApprovalStatusValue
}

/**
 * Portal belgelerinde ortak adres girdisi.
 *
 * `invoice.types.ts`'ten buraya taşındı: serbest meslek makbuzu da aynı
 * alanları (farklı Türkçe anahtar yazımlarıyla) taşıyor ve kardeş modülden
 * import edemiyor. `invoice` bu adı geriye dönük uyumluluk için kendi
 * yüzeyinden yeniden dışa açar.
 *
 * Tüm alanlar opsiyoneldir; verilmeyen alan portala boş string olarak gider.
 * Tek istisna `country`: verilmezse `'Türkiye'` gönderilir.
 *
 * DİKKAT: portal aynı adres alanlarını fatura ile serbest meslek makbuzunda
 * FARKLI Türkçe anahtarlarla adlandırıyor (`bulvarcaddesokak` /
 * `bulvarCaddeSokak`); eşleme bunu kendisi halleder.
 *
 * @example
 * ```ts
 * import { Country } from 'efatura'
 * import type { AddressInput } from 'efatura'
 *
 * const address: AddressInput = {
 *   country: Country.TURKIYE,
 *   city: 'İstanbul',
 *   district: 'Maltepe',
 *   street: 'Bağdat Cd.',
 *   buildingNumber: '12',
 *   doorNumber: '3',
 *   postalCode: '34840',
 * }
 * console.log(address.city)
 * ```
 */
export interface AddressInput {
  /** `ulke` — portal Türkçe ÜLKE ADI bekler, ISO kodu değil. Varsayılan `'Türkiye'`. */
  country?: CountryName
  /** `sehir` — il. */
  city?: string
  /** `mahalleSemtIlce` — mahalle/semt/ilçe. */
  district?: string
  /** Bulvar/cadde/sokak. */
  street?: string
  /** `binaAdi` */
  buildingName?: string
  /** `binaNo` */
  buildingNumber?: string
  /** `kapiNo` */
  doorNumber?: string
  /** `kasabaKoy` — kasaba/köy. */
  town?: string
  /** `postaKodu` */
  postalCode?: string
}
