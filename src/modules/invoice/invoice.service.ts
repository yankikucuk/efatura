import {
  Command,
  DocumentType,
  InvoiceListKind,
  type InvoiceListKindValue,
  PageName,
} from '../../constants/index.js'
import { type DateInput, EArsivValidationError, formatPortalDate } from '../../core/index.js'
import {
  asRows,
  normalizeSummaryDate,
  resolveCreatedEttn,
  toDocumentSummary,
} from '../../documents/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import {
  fromPortalPayload,
  portalTotals,
  toIncomingExternalSummary,
  toPortalInvoice,
} from './invoice.mapper.js'
import {
  computeLineItemForRead,
  computeTotals,
  mergeAndVerifyTotals,
  sumTotals,
} from './invoice.totals.js'
import type {
  CancelDraftOptions,
  CreatedInvoice,
  IncomingExternalSummary,
  InvoiceDetail,
  InvoiceInput,
  InvoiceSummary,
  ListIncomingExternalFilters,
  ListOptions,
} from './invoice.types.js'
import { validateInvoiceInput } from './invoice.validator.js'

/**
 * Fatura oluşturma, listeleme, okuma ve silme işlemleri.
 *
 * `EArsivClient` bunu kendisi kurar ve fatura yöntemlerini buraya delege eder;
 * doğrudan örneklemeniz yalnızca kendi servis birleşiminizi kuracaksanız
 * gerekir. DİKKAT: oluşturma serileştirmesi ÖRNEK BAŞINADIR — iki ayrı
 * `InvoiceService` örneği birbirinin kuyruğunu görmez.
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   HttpClient,
 *   InvoiceService,
 *   resolveClientOptions,
 * } from '@yankikucuk/efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const invoices = new InvoiceService(new DispatchGateway(http, auth))
 * console.log((await invoices.listDrafts(new Date(), new Date())).length)
 * ```
 */
export class InvoiceService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * `createDraft` çağrılarını bu örnek üzerinde SERİLEŞTİRMEK için dahili
   * zincir (round 3 madde 3, mlevent#101).
   *
   * Anlık görüntü-farkı tasarımı (bkz. `createDraft` belgesi) aynı
   * `EArsivClient`/`InvoiceService` örneği üzerinden EŞZAMANLI iki çağrı
   * geldiğinde bozuluyordu: ikisi de aynı "önce" anlık görüntüsünü görüyor,
   * ikisi de fatura oluşturuyor, ikisi de "sonra" listesinde İKİ yeni kayıt
   * buluyor ve ikisi de (aynı alıcı/tarihte, ör. nihai tüketici TCKN'i
   * 11111111111 olduğunda kaçınılmaz) `EArsivAmbiguousResultError` ile
   * REDDEDİLİYORDU — oysa portalda iki fatura da GERÇEKTEN oluşmuştu. İki
   * dosyalanmış fatura + iki hata, sıraya koymaktan daha kötü.
   *
   * Süreçler-arası eşzamanlılık (ör. iki ayrı sunucu süreci) bu zincirle
   * ÇÖZÜLMEZ — bu hâlâ belgelenmiş bir sınır. Çözülen yalnızca AYNI örnek
   * üzerinden gelen kendinden-kaynaklı eşzamanlılıktır.
   *
   * Zincir KENDİSİ asla reddetmez (`.then(ok, ok)` ile her iki dalda da
   * `undefined`'a düşer) — aksi halde bir çağrının başarısızlığı sıradaki
   * TÜM çağrıları sonsuza kadar reddederdi.
   */
  private pending: Promise<unknown> = Promise.resolve()

  /**
   * Taslak fatura oluşturur ve atanan ETTN'i çözer.
   *
   * Portal ETTN'i yanıtta döndürmediği için (spec §2.3) oluşturmadan önce ve
   * sonra taslak listesi alınır ve fark hesaplanır. Fark tekile inmezse
   * `EArsivAmbiguousResultError` fırlatılır — yanlış ETTN dönmek yerine.
   *
   * Bu döngü (anlık görüntü → oluştur → yeniden listele) bu örnek üzerinde
   * `this.pending` zinciriyle serileştirilir: bir çağrı bitmeden bir sonraki
   * başlamaz (bkz. `pending` belgesi).
   *
   * @param input Fatura girdisi; zorunlu alanlar `buyer` ve en az bir
   *   `lineItems` kalemidir. Tutarlar LİRA cinsindendir; `date` verilmezse
   *   bugüne düşer. Ayrıntı için bkz. {@link InvoiceInput}.
   * @returns Oluşan faturanın `ettn`, `documentNumber`, `date` ve
   *   `approvalStatus` alanları.
   * @throws {EArsivValidationError} Girdi doğrulaması başarısızsa ya da
   *   `totals` override'ı kendi içinde tutarsızsa. Bu kontroller KUYRUĞA
   *   GİRMEDEN önce çalışır: geçersiz girdi başka bir çağrıyı beklemez ve ağa
   *   hiç çıkılmaz.
   * @throws {EArsivAmbiguousResultError} Fatura oluşturuldu ancak ETTN tekil
   *   olarak belirlenemedi.
   * @throws {EArsivApiError} Portal oluşturmayı iş kuralıyla reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example Eşzamanlı iki oluşturma — sıraya alınır, ikisi de başarılı olur
   * ```ts
   * import { EArsivClient, Unit } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const [first, second] = await Promise.all([
   *   client.createDraft({
   *     buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
   *     lineItems: [{ name: 'A', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
   *   }),
   *   client.createDraft({
   *     buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
   *     lineItems: [{ name: 'B', quantity: 1, unit: Unit.PIECE, unitPrice: 200, vatRate: 20 }],
   *   }),
   * ])
   * console.log(first.ettn !== second.ettn)
   * ```
   */
  async createDraft(input: InvoiceInput): Promise<CreatedInvoice> {
    validateInvoiceInput(input)
    // Tutarsız `totals` override'ı ağa çıkmadan yakalansın: toplamlar
    // hesaplanır ve override eşitliklere karşı doğrulanır. toPortalInvoice
    // aynı hesabı tekrar yapar; bu ucuz ve saf bir işlem. Kuyruğa girmeden
    // ÖNCE çalışır — geçersiz girdi başka bir çağrıyı beklemeden hemen
    // reddedilir.
    mergeAndVerifyTotals(computeTotals(input.lineItems).totals, input.totals)

    const run = this.pending.then(() => this.createDraftLocked(input))
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  private async createDraftLocked(input: InvoiceInput): Promise<CreatedInvoice> {
    const date = formatPortalDate(input.date)
    const before = new Set((await this.listDrafts(date, date)).map((row) => row.ettn))

    await this.gateway.call<string>(
      Command.CREATE_INVOICE,
      PageName.INVOICE_FORM,
      toPortalInvoice(input),
    )

    const after = await this.listDrafts(date, date)
    const created = resolveCreatedEttn({
      before,
      after,
      hint: {
        buyerTaxOrIdentityNumber: input.buyer.taxOrIdentityNumber,
        buyerName:
          input.buyer.title ??
          `${input.buyer.firstName ?? ''} ${input.buyer.lastName ?? ''}`.trim(),
        date,
      },
    })

    return {
      ettn: created.ettn,
      documentNumber: created.documentNumber,
      date: created.date,
      approvalStatus: created.approvalStatus,
    }
  }

  /**
   * Belirtilen tarih aralığındaki düzenlenen belgeleri listeler.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler. Tek gün için `from` ile
   *   aynı değeri verin.
   * @param options `kind` varsayılan `InvoiceListKind.INTERACTIVE` — YALNIZCA
   *   faturalar. `STANDARD` bir filtre DEĞİL, ÜST KÜMEDİR: fatura ve her iki
   *   makbuz türü birlikte döner.
   * @returns Özet satırları; kayıt yoksa boş dizi. Tek bir satırın alanı
   *   bozuksa (ör. ayrıştırılamayan tarih) fonksiyon FIRLATMAZ — o satır ham
   *   değeriyle döner.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient, InvoiceListKind } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const hepsi = await client.listDrafts('01/09/2026', '30/09/2026', {
   *   kind: InvoiceListKind.STANDARD,
   * })
   * console.log(hepsi.map((row) => row.documentType))
   * ```
   */
  async listDrafts(
    from: DateInput,
    to: DateInput,
    options: ListOptions = {},
  ): Promise<InvoiceSummary[]> {
    const kind: InvoiceListKindValue = options.kind ?? InvoiceListKind.INTERACTIVE
    const data = await this.gateway.call<unknown>(
      Command.LIST_INVOICES,
      kind === InvoiceListKind.STANDARD ? PageName.DRAFTS : PageName.INTERACTIVE_DRAFTS,
      { baslangic: formatPortalDate(from), bitis: formatPortalDate(to), hangiTip: kind },
    )
    return asRows(data).map(toDocumentSummary)
  }

  /**
   * Adına düzenlenen belgeleri listeler.
   *
   * YALNIZCA portalın KENDİSİNDEN düzenlenen belgeleri kapsar; entegratör
   * üzerinden gelenler için `listIncomingExternal` kullanın.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Özet satırları; kayıt yoksa boş dizi.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   * console.log((await client.listIncoming('01/09/2026', '30/09/2026')).length)
   * ```
   */
  async listIncoming(from: DateInput, to: DateInput): Promise<InvoiceSummary[]> {
    const data = await this.gateway.call<unknown>(Command.LIST_INCOMING, PageName.INCOMING_DRAFTS, {
      baslangic: formatPortalDate(from),
      bitis: formatPortalDate(to),
    })
    return asRows(data).map(toDocumentSummary)
  }

  /**
   * "Portal Harici Adıma Düzenlenen Belgeler" — bir ENTEGRATÖR aracılığıyla
   * (portalın kendisi değil) adınıza düzenlenmiş belgeleri listeler.
   *
   * `listIncoming`'den farkı budur: `listIncoming` yalnızca portalın
   * KENDİSİNDEN düzenlenen belgeleri kapsar, ki pratikte büyük firmalardan
   * gelen B2B faturaların çoğu bir entegratör üzerinden gelir ve o listede
   * GÖRÜNMEZ. Üç filtre alanı da portalın kendi ekranında opsiyoneldir; boş
   * bırakılan alan "filtre yok" anlamına gelir.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` metni.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @param filters `sellerTaxOrIdentityNumber`, `documentType` ve
   *   `invoiceNumber`; üçü de opsiyoneldir ve verilmeyen alan portala boş
   *   string olarak gider.
   * @returns Entegratör satırları; `InvoiceSummary`'den farklı olarak SATICI
   *   kimliği ve ayrı bir `invoiceNumber` taşır.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { DocumentType, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const rows = await client.listIncomingExternal('01/09/2026', '30/09/2026', {
   *   sellerTaxOrIdentityNumber: '1111111111',
   *   documentType: DocumentType.INVOICE,
   * })
   * console.log(rows.map((row) => row.invoiceNumber))
   * ```
   */
  async listIncomingExternal(
    from: DateInput,
    to: DateInput,
    filters: ListIncomingExternalFilters = {},
  ): Promise<IncomingExternalSummary[]> {
    const data = await this.gateway.call<unknown>(
      Command.LIST_INCOMING_EXTERNAL,
      PageName.INCOMING_INTEGRATOR,
      {
        saticiVknTckn: filters.sellerTaxOrIdentityNumber ?? '',
        belgeTuru: filters.documentType ?? '',
        faturaNo: filters.invoiceNumber ?? '',
        baslangic: formatPortalDate(from),
        bitis: formatPortalDate(to),
      },
    )
    return asRows(data).map(toIncomingExternalSummary)
  }

  /**
   * Tek bir faturanın tam detayını getirir.
   *
   * Okuma yolu girdi doğrulaması YAPMAZ ve `EArsivValidationError`
   * ÜRETMEZ: portalda kayıtlı bir tuhaflık (boş kalem adı, bozuk tarih)
   * çağrıyı düşürmez — düşürseydi çağıran `detail.raw`'a bile erişemezdi.
   *
   * @param ettn Faturanın ETTN'i; liste satırından dönen değerle birebir aynı
   *   olmalıdır.
   * @returns Eşlenmiş detay. Toplamlar ÖNCELİKLE portalın kendi yanıtından
   *   okunur; alan yanıtta hiç yoksa kalemlerden hesaplanana düşülür.
   * @throws {EArsivApiError} ETTN bulunamazsa veya portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const detail = await client.getInvoice('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * console.log(detail.totals.grandTotal, detail.lineItems.length, detail.raw.faturaTipi)
   * ```
   */
  async getInvoice(ettn: string): Promise<InvoiceDetail> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_INVOICE,
      PageName.INVOICE_FORM,
      { ettn },
    )
    const input = fromPortalPayload(raw)
    // Okuma yolu `computeLineItem`'in girdi doğrulamasını ASLA çalıştırmaz:
    // kullanıcı zaten var olan bir kaydı okuyor, yeni bir kayıt oluşturmuyor.
    // Boş `malHizmet` gibi bir portal tuhaflığı bu isteği reddetmemeli
    // (bkz. I4) — reddederse çağıran `detail.raw`'a bile erişemez.
    const lines = input.lineItems.map((item) => computeLineItemForRead(item))
    // Toplamlar ÖNCELİKLE portalın kendi yanıtından okunur; yalnızca ilgili
    // alan yanıtta hiç yoksa kalemlerden hesaplanana düşülür. Bu kütüphanenin
    // kendi aritmetiği, GİB'in tuttuğu resmi rakamların YERİNE geçmemeli
    // (bkz. I4).
    const totals = portalTotals(raw, sumTotals(lines))

    return {
      ettn,
      documentNumber: input.documentNumber ?? '',
      // formatPortalDate(input.date) fırlardı: input.date str()'ten geliyor
      // ve '' de geçerli bir string olduğundan varsayılana düşmüyor (I5'in
      // okuma yolundaki aynı kör noktası — round 2 madde 3). Bu yöntemin
      // kendi belgesi çağıranın en azından `raw`'a erişebileceğini
      // vaat ediyor; fırlatmak bunu bozardı.
      date: normalizeSummaryDate(input.date),
      time: typeof input.time === 'string' ? input.time : '',
      currency: input.currency ?? 'TRY',
      currencyRate: input.currencyRate ?? 0,
      invoiceType: input.invoiceType ?? 'SATIS',
      buyer: input.buyer,
      lineItems: lines,
      totals,
      note: input.note ?? '',
      raw,
    }
  }

  /**
   * Onaylanmamış bir taslağı siler. Portal özet satırının tamamını istediği
   * için önce liste üzerinden ilgili kayıt bulunur.
   *
   * Arama tarihi varsayılan olarak bugündür; `options.date` ile dünün (veya
   * başka bir günün) bir taslağı da hedeflenebilir (bkz. I10).
   *
   * DİKKAT — DOĞRULANMIŞ KISIT: portalın silme komutu TEST ortamında hiçbir
   * belge türünde çalışmıyor; her denemede `"Silinirken bir sorun oluştu."`
   * döndürüyor (canlı doğrulandı 2026-09-05). Bu kütüphanenin getirdiği bir
   * gerileme değil, portalın önceden var olan davranışıdır ve üretimde
   * doğrulanamamıştır.
   *
   * @param ettn Silinecek taslağın ETTN'i.
   * @param reason Portala gönderilen silme gerekçesi; varsayılan
   *   `'Yanlış İşlem'`.
   * @param options `date` verilmezse BUGÜN aranır; dünkü bir taslağı silmek
   *   için o günün tarihini verin.
   * @returns Silme isteği gönderildiğinde çözülen söz.
   * @throws {EArsivValidationError} Taslak aranan tarihte bulunamazsa; mesaj
   *   `options.date` ipucunu içerir.
   * @throws {EArsivApiError} Portal silmeyi reddederse — test ortamında
   *   BEKLENEN durum.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivApiError, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * try {
   *   await client.cancelDraft('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', 'Yanlış tutar', {
   *     date: '04/09/2026',
   *   })
   * } catch (error) {
   *   if (error instanceof EArsivApiError) console.error(error.message)
   * }
   * ```
   */
  async cancelDraft(
    ettn: string,
    reason = 'Yanlış İşlem',
    options: CancelDraftOptions = {},
  ): Promise<void> {
    const date = formatPortalDate(options.date)
    const candidates = await this.listDrafts(date, date)
    const target = candidates.find((row) => row.ettn === ettn)

    if (target === undefined) {
      throw new EArsivValidationError(
        `Silinecek taslak aranan tarih aralığında bulunamadı: ${ettn} (aranan tarih: ${date}). ` +
          'Fatura başka bir tarihte oluşturulmuş olabilir; options.date ile doğru tarihi belirtin.',
        [{ path: 'ettn', message: `Bulunamayan ETTN: ${ettn} (tarih: ${date})` }],
      )
    }

    await this.gateway.call<string>(Command.DELETE_INVOICE, PageName.INTERACTIVE_DRAFTS, {
      silinecekler: [
        {
          belgeNumarasi: target.documentNumber,
          aliciVknTckn: target.buyerTaxOrIdentityNumber,
          aliciUnvanAdSoyad: target.buyerName,
          belgeTarihi: target.date,
          belgeTuru: DocumentType.INVOICE,
          ettn: target.ettn,
        },
      ],
      aciklama: reason,
    })
  }
}
