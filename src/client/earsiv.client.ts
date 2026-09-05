import { type ClientOptions, type EnvironmentName, resolveClientOptions } from '../config/index.js'
import { DocumentType } from '../constants/index.js'
import type { DateInput } from '../core/index.js'
import { AuthService, type Credentials, type TestUserCredentials } from '../modules/auth/index.js'
import {
  type CancellationRequestInput,
  DisputeService,
  type DisputeRequest,
  type DisputeResponseInput,
  type IncomingObjectionRequestInput,
  type ObjectionRequestInput,
} from '../modules/dispute/index.js'
import {
  type DocumentOptions,
  DocumentService,
  type DownloadOptions,
} from '../modules/document/index.js'
import {
  type CancelDraftOptions,
  type CreatedInvoice,
  type IncomingExternalSummary,
  type InvoiceDetail,
  type InvoiceInput,
  InvoiceService,
  type InvoiceSummary,
  type ListIncomingExternalFilters,
  type ListOptions,
} from '../modules/invoice/index.js'
import {
  type CreatedProducerReceipt,
  type ProducerReceiptDetail,
  type ProducerReceiptInput,
  ProducerReceiptService,
  type ProducerReceiptSummary,
} from '../modules/producer-receipt/index.js'
import {
  type CreatedSelfEmployedReceipt,
  type SelfEmployedReceiptDetail,
  type SelfEmployedReceiptInput,
  SelfEmployedReceiptService,
  type SelfEmployedReceiptSummary,
} from '../modules/self-employed-receipt/index.js'
import {
  type SendSmsOptions,
  SigningService,
  type SmsChallenge,
  type VerifySmsInput,
} from '../modules/signing/index.js'
import { type CompanyInfo, type UserInfo, UserService } from '../modules/user/index.js'
import { renderHtmlToPdf } from '../pdf/index.js'
import { DispatchGateway, HttpClient } from '../transport/index.js'

import type { ToPdfOptions } from './client.types.js'

/**
 * e-Arşiv Portalı istemcisi.
 *
 * Servisleri birleştiren ince bir facade; her yöntem ilgili modül servisine
 * delege eder. Servisler ayrı ayrı da kullanılabilir.
 *
 * Yaşam döngüsü her zaman aynıdır: örneği kur → `login()` (test ortamında
 * `loginWithTestUser()`) → işlemler → `logout()`. Oturum token'ı yalnızca bu
 * örneğin belleğinde tutulur; diske veya başka bir yere yazılmaz.
 *
 * @remarks
 * Belge oluşturan yöntemler (`createDraft`, `createProducerReceipt`,
 * `createSelfEmployedReceipt`) portalda ÜÇ istek yapar: önce mevcut taslak
 * listesi, sonra oluşturma, sonra liste yeniden. Portal oluşturma yanıtında
 * ETTN döndürmediği için kimlik bu iki anlık görüntünün farkından çözülür.
 * AYNI istemci örneği üzerinden gelen eşzamanlı oluşturma çağrıları bu yüzden
 * dahili olarak SIRAYA ALINIR — iki çağrı aynı "önce" görüntüsünü görürse
 * ikisi de belirsiz sonuç hatası alırdı. Ayrı süreçlerden gelen eşzamanlılık
 * bu mekanizmayla çözülmez; belgelenmiş bir sınırdır.
 *
 * @example Test ortamında baştan sona bir akış
 * ```ts
 * import { EArsivClient, Unit } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created = await client.createDraft({
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 250, vatRate: 20 }],
 * })
 * console.log('ETTN:', created.ettn)
 *
 * await client.logout()
 * ```
 *
 * @example Canlı ortam, özel zaman aşımı ve yeniden deneme
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({
 *   environment: 'production',
 *   timeoutMs: 60_000,
 *   // DİKKAT: attempts YALNIZCA salt okunur komutlar için geçerlidir;
 *   // fatura oluşturma gibi mutasyonlar her zaman tek kez denenir.
 *   retry: { attempts: 5, backoffMs: 1_000 },
 * })
 * await client.login({ username: '1111111111', password: 'gizli' })
 * ```
 *
 * @example Hata türlerine göre ayrışma
 * ```ts
 * import {
 *   EArsivApiError,
 *   EArsivAuthError,
 *   EArsivClient,
 *   EArsivNetworkError,
 *   EArsivValidationError,
 * } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 *
 * try {
 *   await client.getInvoice('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues)
 *   else if (error instanceof EArsivAuthError) await client.login({ username: 'u', password: 'p' })
 *   else if (error instanceof EArsivApiError) console.error(error.code, error.messages)
 *   else if (error instanceof EArsivNetworkError) console.error(error.url, error.attempts)
 *   else throw error
 * }
 * ```
 */
export class EArsivClient {
  /**
   * Bu istemcinin bağlandığı portal ortamı; kurulumda çözülür ve sonradan
   * değişmez. `'test'` `earsivportaltest.efatura.gov.tr`, `'production'`
   * `earsivportal.efatura.gov.tr` adresine karşılık gelir.
   */
  readonly environment: EnvironmentName

  private readonly auth: AuthService
  private readonly invoices: InvoiceService
  private readonly documents: DocumentService
  private readonly users: UserService
  private readonly signing: SigningService
  private readonly disputes: DisputeService
  private readonly producerReceipts: ProducerReceiptService
  private readonly selfEmployedReceipts: SelfEmployedReceiptService

  /**
   * Yeni bir istemci kurar. Ağa ÇIKMAZ; yalnızca seçenekleri doğrular ve
   * servisleri örnekler.
   *
   * @param options İstemci seçenekleri; tamamı opsiyoneldir. Verilmeyen her
   *   alan varsayılana düşer: `environment: 'production'`,
   *   `timeoutMs: 30000`, `retry: { attempts: 3, backoffMs: 500 }`, sessiz
   *   logger, masaüstü tarayıcı `User-Agent`'ı ve `globalThis.fetch`. Alan
   *   ayrıntıları için bkz. {@link ClientOptions}.
   * @throws {EArsivValidationError} `environment` `'production'`/`'test'`
   *   dışında bir değerse, `timeoutMs` pozitif değilse, `retry.attempts` 1'den
   *   küçük ya da tam sayı değilse veya `retry.backoffMs` negatifse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const production = new EArsivClient()
   * const test = new EArsivClient({ environment: 'test' })
   * console.log(production.environment, test.environment)
   * ```
   */
  constructor(options: ClientOptions = {}) {
    const resolved = resolveClientOptions(options)
    this.environment = resolved.environment

    const http = new HttpClient(resolved)
    this.auth = new AuthService(http, resolved)
    const gateway = new DispatchGateway(http, this.auth)

    this.invoices = new InvoiceService(gateway)
    this.documents = new DocumentService(gateway, http, this.auth, resolved)
    this.users = new UserService(gateway)
    this.signing = new SigningService(gateway)
    this.disputes = new DisputeService(gateway)
    this.producerReceipts = new ProducerReceiptService(gateway)
    this.selfEmployedReceipts = new SelfEmployedReceiptService(gateway)
  }

  // — Oturum —

  /**
   * Geçerli oturum token'ı.
   *
   * Bir sonraki çalıştırmada `setToken()` ile devam etmek için saklanabilir;
   * SIR niteliğindedir — günlüğe yazmayın, paylaşmayın.
   *
   * @returns Oturum açıksa token, açık değilse `undefined`.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   * const saved: string | undefined = client.token
   * console.log(saved !== undefined)
   * ```
   */
  get token(): string | undefined {
    return this.auth.token
  }

  /**
   * Bellekte bir token bulunup bulunmadığı.
   *
   * `true` olması token'ın portalda HÂLÂ GEÇERLİ olduğunu garanti etmez:
   * portal token'ları sunucu tarafında zaman aşımına uğrar. Süre dolumu ilk
   * çağrıda anlaşılır ve `EArsivAuthError` olarak yükselir; o anda token
   * temizlendiği için bu değer yeniden `false` olur.
   *
   * @returns Token varsa `true`.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * if (!client.isAuthenticated) await client.loginWithTestUser()
   * ```
   */
  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated
  }

  /**
   * Önceden alınmış bir token ile oturuma devam eder.
   *
   * @param token Daha önce `login()`/`loginWithTestUser()` ile alınmış token
   *   dizesi. Boş veya yalnızca boşluktan oluşamaz — öyle bir değer
   *   `isAuthenticated`'ı `true` yapar ama hiçbir isteğe yetki vermezdi.
   * @throws {EArsivValidationError} Token boş ya da yalnızca boşluk ise.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * client.setToken(process.env.EARSIV_TOKEN ?? '')
   * console.log(client.isAuthenticated)
   * ```
   */
  setToken(token: string): void {
    this.auth.setToken(token)
  }

  /**
   * Kullanıcı adı ve şifre ile giriş yapar; token'ı saklar ve döndürür.
   *
   * Giriş DENEMESİ, önceki oturumun token'ını her koşulda düşürür: deneme
   * başarısız olsa bile istemci "kimlik doğrulanmamış" duruma geçer. Aksi
   * halde çok hesaplı bir kullanımda, değiştirdiğini sanan çağıran eski
   * hesabın altında işlem yapmaya devam ederdi.
   *
   * @param credentials Giriş bilgileri. `username` portalın kullanıcı kodu
   *   (genellikle VKN/TCKN), `password` portal şifresidir. Opsiyonel
   *   `loginCommand` alanı ortama göre otomatik seçilir (test → `'login'`,
   *   canlı → `'anologin'`) ve yalnızca portal davranışı değişirse elle
   *   verilmelidir.
   * @returns Portalın verdiği oturum token'ı; aynı değer `token`
   *   özelliğinden de okunabilir.
   * @throws {EArsivAuthError} Portal token döndürmezse (kullanıcı adı veya
   *   şifre hatalı).
   * @throws {EArsivApiError} Portal girişi açık bir hata mesajıyla
   *   reddederse.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa veya yanıt JSON
   *   değilse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * const token = await client.login({
   *   username: process.env.EARSIV_USER ?? '',
   *   password: process.env.EARSIV_PASSWORD ?? '',
   * })
   * console.log(token.length > 0)
   * ```
   */
  async login(credentials: Credentials): Promise<string> {
    return this.auth.login(credentials)
  }

  /**
   * Yalnızca test ortamında; portal otomatik bir test kullanıcısı üretir.
   *
   * Portal her çağrıda YENİ bir test kullanıcısı tahsis eder; iki ayrı
   * çalıştırmanın belge listeleri kıyaslanamaz. Tahsis edilen kullanıcı
   * havuzdan geldiği için önceki çalıştırmalardan kalma belgeler de
   * taşıyabilir — "listede tam olarak N kayıt olmalı" varsayımı kurmayın.
   * Üretilen şifre her zaman `"1"`'dir.
   *
   * @returns Üretilen `username`, sabit `password` (`"1"`) ve bu kullanıcıyla
   *   alınmış `token`.
   * @throws {EArsivAuthError} İstemci `environment: 'test'` ile kurulmamışsa
   *   (ağa hiç çıkılmaz) veya portal kullanıcı kodu döndürmezse.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * const { username, password, token } = await client.loginWithTestUser()
   * console.log(username, password, token.length > 0)
   * ```
   */
  async loginWithTestUser(): Promise<TestUserCredentials> {
    return this.auth.loginWithTestUser()
  }

  /**
   * Oturumu kapatır. Token yoksa hiçbir şey yapmaz ve ağa çıkmaz.
   *
   * Yerel token, uzak çağrı başarısız olsa BİLE temizlenir; hata yine de
   * yukarı iletilir, böylece çağıran uzak oturumun kapatılamadığını bilir.
   *
   * @returns İşlem tamamlandığında çözülen söz.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa. Bu durumda da yerel
   *   token temizlenmiş olur.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   * await client.logout()
   * console.log(client.isAuthenticated)
   * ```
   */
  async logout(): Promise<void> {
    return this.auth.logout()
  }

  // — Fatura —

  /**
   * Taslak fatura oluşturur ve portalın atadığı ETTN'i çözer.
   *
   * ÜÇ portal isteği yapar: taslakları listele → faturayı oluştur → taslakları
   * yeniden listele. Portal oluşturma yanıtında ETTN döndürmediği için kimlik
   * bu iki anlık görüntünün farkından bulunur; fark tekile inmezse yanlış ETTN
   * döndürmek yerine `EArsivAmbiguousResultError` fırlatılır ve adaylar
   * hatanın `candidates` alanında verilir. Aynı istemci örneği üzerindeki
   * eşzamanlı çağrılar dahili olarak sıraya alınır.
   *
   * Toplamlar kalemlerden otomatik hesaplanır; `input.totals` verilirse
   * hesaplananın üzerine yazılır ve tutarlılık eşitlikleri doğrulanır.
   *
   * @param input Fatura girdisi. Zorunlu alanlar `buyer` (en az
   *   `taxOrIdentityNumber` ve ünvan ya da ad/soyad) ve en az bir `lineItems`
   *   kalemidir. `date`/`time` verilmezse şimdiki zamana düşer; `date` bir
   *   `Date` nesnesi ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd`
   *   biçimlerinden biri olabilir. `currency` varsayılan `'TRY'`; TRY dışı bir
   *   para biriminde `currencyRate` zorunludur. Tüm tutarlar LİRA
   *   cinsindendir. Ayrıntı için bkz. {@link InvoiceInput}.
   * @returns Oluşan faturanın `ettn`, `documentNumber`, `date` ve
   *   `approvalStatus` alanları.
   * @throws {EArsivValidationError} Girdi doğrulaması başarısızsa (VKN/TCKN
   *   hane sayısı, boş kalem adı, aralık dışı oran, tutarsız `totals`
   *   override'ı...). Ağa hiç çıkılmaz.
   * @throws {EArsivAmbiguousResultError} Fatura oluşturuldu ancak ETTN tekil
   *   olarak belirlenemedi.
   * @throws {EArsivApiError} Portal oluşturmayı iş kuralıyla reddederse (ör.
   *   alıcı ticari e-Fatura kullanıcısıysa).
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example İskontolu, notlu bir fatura
   * ```ts
   * import { Country, Currency, EArsivClient, Unit } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const created = await client.createDraft({
   *   date: '05/09/2026',
   *   currency: Currency.TURKISH_LIRA,
   *   buyer: {
   *     taxOrIdentityNumber: '11111111111',
   *     firstName: 'Ali',
   *     lastName: 'Yılmaz',
   *     taxOffice: 'Maltepe',
   *     address: { country: Country.TURKIYE, city: 'İstanbul', district: 'Maltepe' },
   *     contact: { email: 'ali@ornek.test' },
   *   },
   *   lineItems: [
   *     { name: 'Yazılım Geliştirme', quantity: 28, unit: Unit.DAY, unitPrice: 3000, vatRate: 20 },
   *     {
   *       name: 'Danışmanlık',
   *       quantity: 4,
   *       unit: Unit.HOUR,
   *       unitPrice: 500,
   *       vatRate: 20,
   *       discountRate: 10,
   *       discountReason: 'Kampanya',
   *     },
   *   ],
   *   note: 'Eylül 2026 hizmet bedeli',
   * })
   * console.log(created.ettn, created.documentNumber)
   * ```
   *
   * @example Belirsiz sonucu ele almak
   * ```ts
   * import { EArsivAmbiguousResultError, EArsivClient, Unit } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * try {
   *   await client.createDraft({
   *     buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
   *     lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
   *   })
   * } catch (error) {
   *   if (error instanceof EArsivAmbiguousResultError) {
   *     // Fatura OLUŞTU; yalnızca hangisi olduğu tekil olarak seçilemedi.
   *     console.error('Adaylar:', error.candidates)
   *   }
   * }
   * ```
   */
  async createDraft(input: InvoiceInput): Promise<CreatedInvoice> {
    return this.invoices.createDraft(input)
  }

  /**
   * Belirtilen tarih aralığında DÜZENLEDİĞİNİZ belgeleri listeler.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
   * @param to Aralığın bitiş tarihi; aynı biçimler. Tek bir gün için `from` ile
   *   aynı değeri verin.
   * @param options Liste türü. `kind` varsayılan olarak
   *   `InvoiceListKind.INTERACTIVE` (`'5000/30000'`) — YALNIZCA faturaları
   *   döndürür. `InvoiceListKind.STANDARD` (`'Buyuk'`) bir filtre DEĞİL, bir
   *   ÜST KÜMEDİR: fatura ve her iki makbuz türü aynı listede gelir ve
   *   satırlar `documentType` ile ayırt edilir.
   * @returns Özet satırları; her satır `ettn`, `documentNumber`,
   *   `buyerTaxOrIdentityNumber`, `buyerName`, `dd/MM/yyyy` biçiminde `date`,
   *   `documentType` ve `approvalStatus` taşır. Kayıt yoksa boş dizi.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa veya takvimde
   *   olmayan bir gün verilirse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example Bugünün faturaları
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const today = new Date()
   * for (const row of await client.listDrafts(today, today)) {
   *   console.log(row.date, row.documentNumber, row.buyerName, row.approvalStatus)
   * }
   * ```
   *
   * @example Tüm belge türlerini (fatura + makbuzlar) tek listede almak
   * ```ts
   * import { EArsivClient, InvoiceListKind } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const all = await client.listDrafts('01/09/2026', '30/09/2026', {
   *   kind: InvoiceListKind.STANDARD,
   * })
   * console.log(all.map((row) => row.documentType))
   * ```
   */
  async listDrafts(
    from: DateInput,
    to: DateInput,
    options?: ListOptions,
  ): Promise<InvoiceSummary[]> {
    return this.invoices.listDrafts(from, to, options)
  }

  /**
   * PORTALIN KENDİSİNDEN adınıza düzenlenen belgeleri listeler.
   *
   * Bir entegratör üzerinden gelen belgeler bu listede GÖRÜNMEZ; onlar için
   * `listIncomingExternal` kullanın.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
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
   *
   * const incoming = await client.listIncoming('01/09/2026', '30/09/2026')
   * console.log('Adıma kesilen belge sayısı:', incoming.length)
   * ```
   */
  async listIncoming(from: DateInput, to: DateInput): Promise<InvoiceSummary[]> {
    return this.invoices.listIncoming(from, to)
  }

  /**
   * Bir ENTEGRATÖR aracılığıyla (portalın kendisi değil) adınıza düzenlenmiş
   * belgeleri listeler — portalın "Portal Harici Adıma Düzenlenen Belgeler"
   * ekranı.
   *
   * Pratikte büyük firmalardan gelen B2B faturaların çoğu bir entegratör
   * üzerinden gelir ve `listIncoming` sonucunda GÖRÜNMEZ; bu iki liste
   * birbirinin yerine geçmez.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @param filters Üçü de opsiyonel; boş bırakılan alan "filtre yok"
   *   anlamına gelir. `sellerTaxOrIdentityNumber` belgeyi düzenleyen satıcının
   *   VKN/TCKN'i, `documentType` belge türü, `invoiceNumber` entegratörün
   *   verdiği fatura numarasıdır.
   * @returns Entegratör satırları; `InvoiceSummary`'den farklı olarak SATICI
   *   kimliği (`sellerTaxOrIdentityNumber`, `sellerName`) ve ayrı bir
   *   `invoiceNumber` taşır.
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
   *   documentType: DocumentType.INVOICE,
   * })
   * for (const row of rows) console.log(row.sellerName, row.invoiceNumber)
   * ```
   */
  async listIncomingExternal(
    from: DateInput,
    to: DateInput,
    filters?: ListIncomingExternalFilters,
  ): Promise<IncomingExternalSummary[]> {
    return this.invoices.listIncomingExternal(from, to, filters)
  }

  /**
   * Tek bir faturanın tam detayını getirir.
   *
   * Toplamlar ÖNCELİKLE portalın kendi yanıtından okunur; yalnızca ilgili alan
   * yanıtta hiç yoksa kalemlerden hesaplanana düşülür — bu kütüphanenin
   * aritmetiği GİB'in tuttuğu resmi rakamların yerine geçmez. Okuma yolu girdi
   * doğrulaması yapmaz: portalda kayıtlı bir tuhaflık (ör. boş kalem adı)
   * çağrıyı düşürmez, çünkü düşürseydi çağıran `detail.raw`'a bile
   * erişemezdi.
   *
   * @param ettn Faturanın ETTN'i (portalın atadığı UUID). Listeleme
   *   yöntemlerinden dönen `ettn` değeriyle birebir aynı olmalıdır.
   * @returns Eşlenmiş detay; eşlemede kapsanmayan alanlara `raw` üzerinden
   *   erişilebilir.
   * @throws {EArsivApiError} ETTN portalda bulunamazsa veya portal isteği
   *   reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const [first] = await client.listDrafts(new Date(), new Date())
   * if (first !== undefined) {
   *   const detail = await client.getInvoice(first.ettn)
   *   console.log(detail.totals.grandTotal, detail.lineItems.length)
   *   console.log(detail.raw.faturaTipi)
   * }
   * ```
   */
  async getInvoice(ettn: string): Promise<InvoiceDetail> {
    return this.invoices.getInvoice(ettn)
  }

  /**
   * Onaylanmamış bir taslağı siler.
   *
   * DİKKAT — DOĞRULANMIŞ KISIT: portalın silme komutu
   * (`EARSIV_PORTAL_FATURA_SIL`) TEST ortamında hiçbir belge türünde
   * çalışmıyor; her denemede `"Silinirken bir sorun oluştu."` döndürüyor
   * (canlı doğrulandı 2026-09-05; tam liste satırı ve minimal yük, iki farklı
   * `pageName` ve üç belge türü denendi). Bu kütüphanenin getirdiği bir
   * gerileme değil, portalın önceden var olan davranışıdır ve üretim
   * ortamında doğrulanamamıştır (gerçek hukuki belge oluşturmadan test
   * edilemez). Yani bu yöntemi "çalışıyor" varsayarak akış kurmayın.
   *
   * Portal özet satırının tamamını istediği için önce ilgili gün listelenir ve
   * kayıt orada aranır.
   *
   * @param ettn Silinecek taslağın ETTN'i.
   * @param reason Portala gönderilen silme gerekçesi. Varsayılan
   *   `'Yanlış İşlem'`.
   * @param options Arama tarihi. `options.date` verilmezse BUGÜN aranır; dünkü
   *   (veya daha eski) bir taslağı silmek için o günün tarihini verin.
   * @returns Silme isteği başarıyla gönderildiğinde çözülen söz.
   * @throws {EArsivValidationError} Taslak aranan tarih aralığında
   *   bulunamazsa (mesaj `options.date` ipucunu içerir).
   * @throws {EArsivApiError} Portal silmeyi reddederse — test ortamında
   *   BEKLENEN durum budur.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example Dünkü bir taslağı hedeflemek
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
   *   // Test portalı silmeyi her koşulda reddediyor.
   *   if (error instanceof EArsivApiError) console.error(error.message)
   * }
   * ```
   */
  async cancelDraft(ettn: string, reason?: string, options?: CancelDraftOptions): Promise<void> {
    return this.invoices.cancelDraft(ettn, reason, options)
  }

  // — Belge —

  /**
   * Faturanın portal tarafından üretilen HTML gösterimini getirir.
   *
   * Fatura ve müstahsil makbuzunda çalışır (canlı doğrulandı); serbest meslek
   * makbuzunda portal bozuktur — bkz. `getSelfEmployedReceiptHtml`.
   *
   * @param ettn Belgenin ETTN'i.
   * @param options `signed: true` verilirse portaldan İMZALI (onaylanmış)
   *   sürüm istenir; varsayılan `false` (onaylanmamış taslak gösterimi).
   * @returns Tam bir HTML belgesi (canlı portalda 47-55 KB).
   * @throws {EArsivPortalDefectError} Portal HTML gösteriminde bir Java
   *   istisnası sızdırırsa. Bu metin İKİ durumu birden ifade eder ve portal
   *   ikisini ayırt etmez: (1) ETTN bulunamadı ya da biçimi hatalı,
   *   (2) ETTN bir Serbest Meslek Makbuzuna ait. ÖNCE ETTN'i doğrulayın.
   * @throws {EArsivApiError} Portal isteği başka bir gerekçeyle reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * const html = await client.getInvoiceHtml(ettn, { signed: false })
   * await writeFile(`${ettn}.html`, html, 'utf8')
   * ```
   */
  async getInvoiceHtml(ettn: string, options?: DocumentOptions): Promise<string> {
    return this.documents.getHtml(ettn, options)
  }

  /**
   * Faturanın resmi belge paketi (ZIP): HTML + imzalı UBL-TR XML.
   *
   * Fatura ZIP'i `<ettn>_f.html` ve imzalı `<ettn>_f.xml` içerir; PDF YOKTUR —
   * PDF isteniyorsa `toPdf` HTML üzerinden üretir ve o çıktı resmi imzalı
   * belge değildir. `_f` eki yalnızca FATURA içindir; müstahsil paketinde
   * dosyalar `_m` ekiyle gelir.
   *
   * Belge türü `options.documentType` ile değiştirilebilir (varsayılan
   * `FATURA`) ama makbuzlarda ADI FORMATI SÖYLEYEN metotları tercih edin:
   * {@link EArsivClient.downloadProducerReceiptPackage} (ZIP) ve
   * {@link EArsivClient.downloadSelfEmployedReceiptPdf} (PDF). Sebebi:
   * `SERBEST MESLEK MAKBUZU` türünde portal ZIP değil, doğrudan PDF döndürür —
   * "paket" adlı bir metottan PDF almak şaşırtıcıdır.
   *
   * DİKKAT: yanlış belge türü SESSİZCE boş yanıt üretir (portal `HTTP 200` +
   * 0 bayt, hata metni yok); istemci bunu `EArsivNetworkError`'a çevirir ama
   * sebebin TÜR olduğunu söyleyemez.
   *
   * @param ettn Belgenin ETTN'i.
   * @param options `documentType` belge türü (varsayılan `FATURA`),
   *   `signed: true` imzalı sürümü ister (varsayılan `false`).
   * @returns Dosyanın ham baytları — fatura ve müstahsilde ZIP, serbest meslek
   *   makbuzunda PDF.
   * @throws {EArsivNetworkError} Portal boş gövde döndürürse (ETTN, belge
   *   türü veya onay durumu hatalı olabilir) ya da portala ulaşılamazsa.
   * @throws {EArsivAuthError} Oturum yoksa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * await writeFile(`${ettn}_f.zip`, await client.downloadPackage(ettn))
   * ```
   */
  async downloadPackage(ettn: string, options?: DownloadOptions): Promise<Uint8Array> {
    return this.documents.downloadPackage(ettn, options)
  }

  /**
   * Belge paketinin indirme adresini üretir; tarayıcıya veya harici bir
   * indiriciye verilebilir. Ağa çıkmaz, yalnızca URL kurar.
   *
   * UYARI: dönen URL, geçerli oturumun CANLI token'ını sorgu dizesinde
   * (`token=...`) taşır ve bu değer burada GİZLENMEZ (gizleme yalnızca
   * `EArsivNetworkError` ve günlükler içindir). URL'yi bir tarayıcıya
   * yapıştırırsanız token tarayıcı geçmişinde ve URL'ye giden herhangi bir
   * isteğin `Referer` başlığında açığa çıkar. Yalnızca güvendiğiniz bir
   * bağlamda kullanın ve paylaşmayın.
   *
   * Adresin indireceği FORMAT belge türüne göre değişir: `FATURA` ve
   * `MÜSTAHSİL MAKBUZU` bir ZIP, `SERBEST MESLEK MAKBUZU` doğrudan bir PDF
   * verir. Tür `options.documentType` ile seçilir (varsayılan `FATURA`);
   * makbuzlarda {@link EArsivClient.getProducerReceiptDownloadUrl} ve
   * {@link EArsivClient.getSelfEmployedReceiptPdfUrl} aynı işi formatı adında
   * söyleyerek yapar. Yanlış tür portalda SESSİZCE boş yanıt üretir.
   *
   * @param ettn Belgenin ETTN'i.
   * @param options `documentType` belge türü (varsayılan `FATURA`),
   *   `signed: true` imzalı sürümün adresini üretir (varsayılan `false`).
   * @returns Tam indirme adresi (taban adres + `/earsiv-services/download` +
   *   sorgu dizesi).
   * @throws {EArsivAuthError} Oturum açık değilse — URL token olmadan
   *   kurulamaz.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const url = client.getDownloadUrl('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * // Token taşır: günlüğe yazmayın, paylaşmayın.
   * console.log(url.startsWith('https://earsivportaltest.efatura.gov.tr'))
   * ```
   */
  getDownloadUrl(ettn: string, options?: DownloadOptions): string {
    return this.documents.getDownloadUrl(ettn, options)
  }

  /**
   * Faturanın HTML gösterimini PDF'e çevirir. `puppeteer` kurulu olmalıdır.
   *
   * Çıktı RESMİ İMZALI BELGE DEĞİLDİR: resmi belge paketi PDF içermez, imzalı
   * sürüm `downloadPackage` ZIP'i içindeki UBL-TR XML dosyasıdır.
   *
   * @param ettn Belgenin ETTN'i.
   * @param options Belge ve PDF seçeneklerinin birleşimi: `signed` (imzalı
   *   gösterim), `format` (`'A4'` varsayılan, `'A5'`, `'Letter'`),
   *   `printBackground` (varsayılan `true`), `margin` (varsayılan her yönde
   *   `10mm`) ve test/özel dağıtımlar için `moduleName`.
   * @returns PDF dosyasının ham baytları.
   * @throws {EArsivValidationError} `puppeteer` kurulu değilse veya portal boş
   *   HTML döndürdüyse.
   * @throws {EArsivPortalDefectError} ETTN bir Serbest Meslek Makbuzuna aitse
   *   (portal kusuru) veya ETTN geçersizse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * const pdf = await client.toPdf(ettn, { format: 'A4', signed: false })
   * await writeFile(`${ettn}.pdf`, pdf)
   * ```
   */
  async toPdf(ettn: string, options: ToPdfOptions = {}): Promise<Uint8Array> {
    const html = await this.documents.getHtml(ettn, options)
    return renderHtmlToPdf(html, options)
  }

  // — Müstahsil Makbuzu —

  /**
   * Taslak müstahsil makbuzu oluşturur ve portalın atadığı ETTN'i çözer.
   *
   * Faturadaki gibi ÜÇ portal isteği yapar (listele → oluştur → yeniden
   * listele) ve ETTN'i anlık görüntü farkıyla bulur; portal makbuzlarda da
   * ETTN'i kendisi atar ve istemcinin gönderdiğini yok sayar. Aynı istemci
   * örneği üzerindeki eşzamanlı çağrılar sıraya alınır — aynı üreticiye aynı
   * gün art arda makbuz kesmek olağan olduğu için burada risk daha da
   * yüksektir.
   *
   * DİKKAT: portal makbuz tutarlarını NE HESAPLAR NE DOĞRULAR (canlı
   * doğrulandı: kasıtlı yanlış bir `odenecekTutar` aynen saklandı). Bu
   * kütüphanenin aritmetiği belgenin doğruluğunun TEK güvencesidir; bu yüzden
   * makbuzlarda `totals` override'ı bilinçli olarak AÇILMAMIŞTIR.
   *
   * @param input Makbuz girdisi. Zorunlu alanlar `producer`
   *   (`taxOrIdentityNumber` ve ad ya da soyad — müstahsil makbuzunda `unvan`
   *   YOKTUR, belge yalnızca gerçek kişiye kesilir) ve en az bir `lineItems`
   *   kalemidir. `deliveryDate` verilmezse belge tarihine düşer. Dört kesinti
   *   (gelir vergisi stopajı, mera fonu, borsa tescil ücreti, SGK primi) kalem
   *   düzeyinde `taxRates` ile yüzde olarak verilir; verilmeyen kesinti sıfır
   *   sayılır. Bkz. {@link ProducerReceiptInput}.
   * @returns Oluşan makbuzun `ettn`, `documentNumber`, `date` ve
   *   `approvalStatus` alanları.
   * @throws {EArsivValidationError} Girdi doğrulaması başarısızsa. Ağa
   *   çıkılmaz.
   * @throws {EArsivAmbiguousResultError} Makbuz oluşturuldu ancak ETTN tekil
   *   olarak belirlenemedi.
   * @throws {EArsivApiError} Portal oluşturmayı reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient, Unit } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const created = await client.createProducerReceipt({
   *   producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
   *   city: 'Konya',
   *   note: 'Eylül alımı',
   *   deliveryDate: '05/09/2026',
   *   lineItems: [
   *     {
   *       name: 'Buğday',
   *       quantity: 100,
   *       unit: Unit.KILOGRAM,
   *       unitPrice: 12,
   *       taxRates: { incomeTaxWithholding: 2, pastureFund: 1 },
   *     },
   *   ],
   * })
   * console.log(created.ettn)
   * ```
   */
  async createProducerReceipt(input: ProducerReceiptInput): Promise<CreatedProducerReceipt> {
    return this.producerReceipts.createReceipt(input)
  }

  /**
   * Müstahsil makbuzlarını listeler.
   *
   * Portal ayrı bir makbuz listeleme komutu sunmuyor; fatura ile aynı liste
   * bir ÜST KÜMEDİR ve sonuç `belgeTuru` ile süzülür.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Yalnızca `documentType === 'MÜSTAHSİL MAKBUZU'` olan özet
   *   satırları; kayıt yoksa boş dizi.
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
   *
   * const rows = await client.listProducerReceipts('01/09/2026', '30/09/2026')
   * console.log(rows.map((row) => `${row.documentNumber} ${row.date}`))
   * ```
   */
  async listProducerReceipts(from: DateInput, to: DateInput): Promise<ProducerReceiptSummary[]> {
    return this.producerReceipts.listReceipts(from, to)
  }

  /**
   * Tek bir müstahsil makbuzunun tam detayını getirir.
   *
   * Tutarlar YENİDEN HESAPLANMAZ: portal hem kalem düzeyinde oranları ve
   * tutarları hem de belge düzeyinde kesinti toplamlarını döndürür ve kayıtlı
   * olan rakam GİB'in tuttuğu rakamdır. Portalın `not` alanının sonuna
   * eklediği tek satır sonu kırpılır.
   *
   * @param ettn Makbuzun ETTN'i; liste satırından dönen değerle birebir aynı
   *   olmalıdır.
   * @returns Eşlenmiş detay; kapsanmayan alanlara `raw` üzerinden erişilir.
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
   * const [row] = await client.listProducerReceipts(new Date(), new Date())
   * if (row !== undefined) {
   *   const detail = await client.getProducerReceipt(row.ettn)
   *   console.log(detail.totals.payableAmount, detail.totals.taxAmounts.incomeTaxWithholding)
   * }
   * ```
   */
  async getProducerReceipt(ettn: string): Promise<ProducerReceiptDetail> {
    return this.producerReceipts.getReceipt(ettn)
  }

  /**
   * Müstahsil makbuzunun portal tarafından üretilen HTML gösterimi.
   *
   * Fatura ile AYNI portal komutunu kullanır ve çalışır (canlı doğrulandı
   * 2026-09-05, 51 KB HTML). Serbest meslek makbuzunda aynı komut portal
   * kusuru nedeniyle çalışmaz; bkz. `getSelfEmployedReceiptHtml`.
   *
   * @param ettn Makbuzun ETTN'i.
   * @param options `signed: true` imzalı sürümü ister; varsayılan `false`.
   * @returns Tam bir HTML belgesi.
   * @throws {EArsivPortalDefectError} Portal Java istisnası sızdırırsa —
   *   pratikte ETTN'in hatalı olduğu anlamına gelir.
   * @throws {EArsivApiError} Portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const html = await client.getProducerReceiptHtml('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * console.log(html.length)
   * ```
   */
  async getProducerReceiptHtml(ettn: string, options?: DocumentOptions): Promise<string> {
    return this.documents.getHtml(ettn, options)
  }

  /**
   * Müstahsil makbuzunun HTML gösterimini PDF'e çevirir. `puppeteer` kurulu
   * olmalıdır. Çıktı resmi imzalı belge değildir.
   *
   * @param ettn Makbuzun ETTN'i.
   * @param options Belge ve PDF seçeneklerinin birleşimi: `signed`, `format`
   *   (varsayılan `'A4'`), `printBackground` (varsayılan `true`), `margin`
   *   (varsayılan her yönde `10mm`), `moduleName`.
   * @returns PDF dosyasının ham baytları.
   * @throws {EArsivValidationError} `puppeteer` kurulu değilse.
   * @throws {EArsivPortalDefectError} Portal gösterimi reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const pdf = await client.producerReceiptToPdf('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * await writeFile('mustahsil.pdf', pdf)
   * ```
   */
  async producerReceiptToPdf(ettn: string, options: ToPdfOptions = {}): Promise<Uint8Array> {
    const html = await this.documents.getHtml(ettn, options)
    return renderHtmlToPdf(html, options)
  }

  /**
   * Müstahsil makbuzunun resmi belge paketini (ZIP) indirir.
   *
   * `downloadPackage`'ın makbuz karşılığıdır ve tek farkı sorguya
   * `belgeTip: 'MÜSTAHSİL MAKBUZU'` koymasıdır. Bu ayrı metot GEREKLİDİR,
   * kolaylık değildir: alan bir zamanlar sabit `FATURA` gönderiliyordu ve
   * makbuz indirme bu yüzden hiç çalışmıyordu — portal, makbuz ETTN'i +
   * `belgeTip=FATURA` çiftine `HTTP 200` ve **0 bayt** ile karşılık veriyor,
   * hata metni YOK (canlı doğrulandı 2026-09-05).
   *
   * FORMAT: ZIP. Paket `<ettn>_m.html` ve imzalı `<ettn>_m.xml` (UBL-TR)
   * içerir — faturadaki `_f` ekinin makbuz karşılığı. PDF YOKTUR; portalın
   * ZIP paketinde hiçbir belge türü için PDF bulunmaz (serbest meslek
   * makbuzu hariç, orada ZIP'in kendisi yoktur).
   *
   * `content-type` başlığı `application/json` yazar; YANILTICIDIR. Formatı
   * doğrulamak isterseniz sihirli baytlara bakın (`PK`).
   *
   * @param ettn Makbuzun ETTN'i; `listProducerReceipts` satırlarından dönen
   *   değerle birebir aynı olmalıdır.
   * @param options `signed: true` imzalı (onaylanmış) sürümü ister;
   *   varsayılan `false`. Belge türü metodun kendisi tarafından verilir.
   * @returns ZIP dosyasının ham baytları.
   * @throws {EArsivNetworkError} Portal boş gövde döndürürse (ETTN veya onay
   *   durumu hatalı olabilir) ya da portala ulaşılamazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * const zip = await client.downloadProducerReceiptPackage(ettn)
   * console.log(zip[0] === 0x50 && zip[1] === 0x4b) // 'PK' — ZIP imzası
   * await writeFile(`${ettn}_m.zip`, zip)
   * ```
   */
  async downloadProducerReceiptPackage(
    ettn: string,
    options?: DocumentOptions,
  ): Promise<Uint8Array> {
    return this.documents.downloadPackage(ettn, {
      ...options,
      documentType: DocumentType.PRODUCER_RECEIPT,
    })
  }

  /**
   * Müstahsil makbuzu ZIP paketinin indirme adresini üretir. AĞA ÇIKMAZ.
   *
   * UYARI: dönen URL, geçerli oturumun CANLI token'ını sorgu dizesinde
   * (`token=...`) taşır ve bu değer GİZLENMEZ. URL'yi bir tarayıcıya
   * yapıştırırsanız token tarayıcı geçmişinde ve URL'ye giden herhangi bir
   * isteğin `Referer` başlığında açığa çıkar. Yalnızca güvendiğiniz bir
   * bağlamda kullanın ve paylaşmayın. Adres ayrıca oturumu AÇAN istemcinin
   * IP'sine bağlıdır (bkz. README).
   *
   * @param ettn Makbuzun ETTN'i.
   * @param options `signed: true` imzalı sürümün adresini üretir; varsayılan
   *   `false`.
   * @returns ZIP indirecek tam adres.
   * @throws {EArsivAuthError} Oturum açık değilse — URL token olmadan
   *   kurulamaz.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const url = client.getProducerReceiptDownloadUrl('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * // CANLI token taşır: günlüğe yazmayın, paylaşmayın.
   * console.log(url.includes('belgeTip='))
   * ```
   */
  getProducerReceiptDownloadUrl(ettn: string, options?: DocumentOptions): string {
    return this.documents.getDownloadUrl(ettn, {
      ...options,
      documentType: DocumentType.PRODUCER_RECEIPT,
    })
  }

  // — Serbest Meslek Makbuzu —

  /**
   * Taslak serbest meslek makbuzu oluşturur ve portalın atadığı ETTN'i çözer.
   *
   * Faturadaki gibi ÜÇ portal isteği yapar (listele → oluştur → yeniden
   * listele); portal ETTN'i kendisi atar. Aynı istemci örneği üzerindeki
   * eşzamanlı çağrılar sıraya alınır.
   *
   * Tutar zinciri TAMAMEN bu kütüphanede hesaplanır — portal hiçbirini
   * hesaplamaz, gönderilmeyen alanı 0 olarak saklar (canlı doğrulandı):
   * stopaj = brüt × stopaj oranı, net ücret = brüt − stopaj, KDV = BRÜT ×
   * KDV oranı (matrah net ücret DEĞİLDİR), KDV tevkifatı = KDV × tevkifat
   * oranı, tahsil edilen KDV = KDV − tevkifat, net alınan = net ücret +
   * tahsil edilen KDV.
   *
   * @param input Makbuz girdisi. Zorunlu alanlar `payer`
   *   (`taxOrIdentityNumber` ve ünvan ya da ad/soyad — faturadan farklı
   *   olarak SMM tüzel kişiye de düzenlenebilir) ve en az bir `lineItems`
   *   kalemidir. `currency` varsayılan `'TRY'`; TRY dışında `currencyRate`
   *   zorunludur. `vatWithholdingRate` YÜZDE olarak verilir (mevzuattaki
   *   5/10 → `50`). Bkz. {@link SelfEmployedReceiptInput}.
   * @returns Oluşan makbuzun `ettn`, `documentNumber`, `date` ve
   *   `approvalStatus` alanları.
   * @throws {EArsivValidationError} Girdi doğrulaması başarısızsa. Ağa
   *   çıkılmaz.
   * @throws {EArsivAmbiguousResultError} Makbuz oluşturuldu ancak ETTN tekil
   *   olarak belirlenemedi.
   * @throws {EArsivApiError} Portal oluşturmayı reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const created = await client.createSelfEmployedReceipt({
   *   payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
   *   description: 'Eylül 2026 danışmanlık',
   *   lineItems: [
   *     {
   *       description: 'Mali müşavirlik hizmeti',
   *       grossFee: 10_000,
   *       vatRate: 20,
   *       withholdingRate: 20,
   *       // Mevzuattaki 5/10 tevkifat oranı yüzdeye çevrilerek verilir.
   *       vatWithholdingRate: 50,
   *     },
   *   ],
   * })
   * console.log(created.ettn)
   * ```
   */
  async createSelfEmployedReceipt(
    input: SelfEmployedReceiptInput,
  ): Promise<CreatedSelfEmployedReceipt> {
    return this.selfEmployedReceipts.createReceipt(input)
  }

  /**
   * Serbest meslek makbuzlarını listeler (ÜST KÜME listesinden süzülür).
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Yalnızca `documentType === 'SERBEST MESLEK MAKBUZU'` olan özet
   *   satırları; kayıt yoksa boş dizi.
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
   *
   * const rows = await client.listSelfEmployedReceipts(new Date(), new Date())
   * console.log(rows.length)
   * ```
   */
  async listSelfEmployedReceipts(
    from: DateInput,
    to: DateInput,
  ): Promise<SelfEmployedReceiptSummary[]> {
    return this.selfEmployedReceipts.listReceipts(from, to)
  }

  /**
   * Tek bir serbest meslek makbuzunun tam detayını getirir.
   *
   * Portal KALEM düzeyinde türetilmiş tutarları (stopaj, KDV, KDV tevkifatı)
   * hiç döndürmez — yalnızca oranlar gelir; `netUcret`/`netAlinan` alanları
   * portalın hesabı değil, oluşturma sırasında gönderilenin yankısıdır. Bu
   * yüzden kalem tutarları oranlardan YENİDEN HESAPLANIR. BELGE düzeyi
   * toplamlar ise portalın kendi kaydından okunur; portalın sakladığı ham
   * değerlere `detail.raw` üzerinden erişilebilir.
   *
   * @param ettn Makbuzun ETTN'i; liste satırından dönen değerle birebir aynı
   *   olmalıdır.
   * @returns Eşlenmiş detay; kapsanmayan alanlara `raw` üzerinden erişilir.
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
   * const [row] = await client.listSelfEmployedReceipts(new Date(), new Date())
   * if (row !== undefined) {
   *   const detail = await client.getSelfEmployedReceipt(row.ettn)
   *   console.log(detail.totals.netReceived, detail.lineItems[0]?.vatAmount)
   * }
   * ```
   */
  async getSelfEmployedReceipt(ettn: string): Promise<SelfEmployedReceiptDetail> {
    return this.selfEmployedReceipts.getReceipt(ettn)
  }

  /**
   * DESTEKLENMEZ — portal kusuru. Her zaman `EArsivPortalDefectError`
   * fırlatır ve ağa hiç çıkmaz.
   *
   * Portal, geçerli bir SMM ETTN'i ile çağrılan `EARSIV_PORTAL_FATURA_GOSTER`
   * komutuna sızdırılmış bir Java istisnasıyla yanıt veriyor
   * (`"String index out of range: 4"`, canlı doğrulandı 2026-09-05). Denenen
   * ve hepsi aynı hatayı veren varyantlar: `pageName` `RG_SERBEST` ve
   * `RG_TASLAKLAR`, ek `belgeTuru` alanı, liste ETTN'i, detay ETTN'i ve belge
   * numarası; alternatif komut adları portalda mevcut değil. Aynı komut
   * müstahsil makbuzunda sorunsuz çalışıyor, yani kusur SMM'ye özgüdür ve
   * istemci tarafında düzeltilemez.
   *
   * Metot bilinçli olarak SİLİNMEDİ: silinseydi çağıran `getInvoiceHtml`'i
   * bir SMM ETTN'i ile denerdi ve portalın ham Java istisnasını kendi hatası
   * sanardı. Buradaki hata kusurun portalda olduğunu ve çalışan alternatifi
   * açıkça söyler.
   *
   * @param ettn Makbuzun ETTN'i. Yalnızca hata mesajında yankılanır; hiçbir
   *   istekte kullanılmaz.
   * @returns Hiçbir zaman dönmez (`never`).
   * @throws {EArsivPortalDefectError} HER ZAMAN. `command` alanı
   *   `EARSIV_PORTAL_FATURA_GOSTER`, `portalMessage` alanı portalın kendi
   *   istisna metnidir.
   *
   * @example Çalışan alternatife düşmek
   * ```ts
   * import { EArsivClient, EArsivPortalDefectError } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * try {
   *   client.getSelfEmployedReceiptHtml(ettn)
   * } catch (error) {
   *   if (!(error instanceof EArsivPortalDefectError)) throw error
   *   // Kusur portalda; makbuzun TÜM verilerine bu yolla erişilir.
   *   const detail = await client.getSelfEmployedReceipt(ettn)
   *   console.log(detail.totals.netReceived)
   * }
   * ```
   */
  getSelfEmployedReceiptHtml(ettn: string): never {
    return this.selfEmployedReceipts.getHtml(ettn)
  }

  /**
   * DESTEKLENMEZ — PDF, bozuk olan HTML gösterimi üzerine kuruludur.
   *
   * @param ettn Makbuzun ETTN'i. Yalnızca hata mesajında yankılanır.
   * @returns Hiçbir zaman dönmez (`never`).
   * @throws {EArsivPortalDefectError} HER ZAMAN; `getSelfEmployedReceiptHtml`
   *   ile aynı mesaj ve bağlam.
   *
   * @example
   * ```ts
   * import { EArsivClient, EArsivPortalDefectError } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   *
   * try {
   *   client.selfEmployedReceiptToPdf('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * } catch (error) {
   *   console.error(error instanceof EArsivPortalDefectError, (error as Error).message)
   * }
   * ```
   */
  selfEmployedReceiptToPdf(ettn: string): never {
    return this.selfEmployedReceipts.toPdf(ettn)
  }

  /**
   * Serbest meslek makbuzunun RESMİ PDF'ini indirir — portal bu türde ZIP
   * paketi değil, doğrudan PDF döndürür (`%PDF-1.5`, `content-disposition`
   * dosya adı `<ettn>_s.pdf`; canlı doğrulandı 2026-09-05).
   *
   * Metodun adı `...Package` DEĞİL `...Pdf`tir, çünkü dönen şey gerçekten
   * budur: aynı uç nokta faturada ve müstahsilde ZIP verir, SMM'de PDF. Adı
   * "paket" olan bir metottan PDF almak kullanıcıyı şaşırtır ve `.zip`
   * uzantısıyla yazılmış bozuk dosyalar üretirdi.
   *
   * BU, SMM KISITINI ÖNEMLİ ÖLÇÜDE YUMUŞATIR. `getSelfEmployedReceiptHtml`
   * ve `selfEmployedReceiptToPdf` portal kusuru nedeniyle desteklenmiyor,
   * ancak bozuk olan yalnızca HTML GÖSTERİMİDİR: basılabilir resmî belgeye bu
   * metotla erişilir. `selfEmployedReceiptToPdf`'in üreteceği çıktının aksine
   * buradaki PDF portalın kendi RESMİ belgesidir, yerel bir render değildir.
   *
   * `content-type` başlığı `application/json` yazar; YANILTICIDIR. Formatı
   * doğrulamak isterseniz sihirli baytlara bakın (`%PDF`).
   *
   * @param ettn Makbuzun ETTN'i; `listSelfEmployedReceipts` satırlarından
   *   dönen değerle birebir aynı olmalıdır.
   * @param options `signed: true` imzalı (onaylanmış) sürümü ister;
   *   varsayılan `false`. Belge türü metodun kendisi tarafından verilir.
   * @returns PDF dosyasının ham baytları. ZIP DEĞİLDİR — açmaya çalışmayın.
   * @throws {EArsivNetworkError} Portal boş gövde döndürürse (ETTN veya onay
   *   durumu hatalı olabilir) ya da portala ulaşılamazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const ettn = '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f'
   * const pdf = await client.downloadSelfEmployedReceiptPdf(ettn)
   * console.log(new TextDecoder().decode(pdf.slice(0, 4))) // '%PDF'
   * await writeFile(`${ettn}_s.pdf`, pdf)
   * ```
   */
  async downloadSelfEmployedReceiptPdf(
    ettn: string,
    options?: DocumentOptions,
  ): Promise<Uint8Array> {
    return this.documents.downloadPackage(ettn, {
      ...options,
      documentType: DocumentType.SELF_EMPLOYED_RECEIPT,
    })
  }

  /**
   * Serbest meslek makbuzunun resmî PDF'ini indirecek adresi üretir.
   * AĞA ÇIKMAZ; yalnızca URL kurar.
   *
   * Adın `...PdfUrl` olması bilinçlidir: bu adres bir ZIP değil, doğrudan PDF
   * indirir (bkz. {@link EArsivClient.downloadSelfEmployedReceiptPdf}).
   *
   * UYARI: dönen URL, geçerli oturumun CANLI token'ını sorgu dizesinde
   * (`token=...`) taşır ve bu değer GİZLENMEZ. URL'yi bir tarayıcıya
   * yapıştırırsanız token tarayıcı geçmişinde ve URL'ye giden herhangi bir
   * isteğin `Referer` başlığında açığa çıkar. Yalnızca güvendiğiniz bir
   * bağlamda kullanın ve paylaşmayın. Adres ayrıca oturumu AÇAN istemcinin
   * IP'sine bağlıdır (bkz. README).
   *
   * @param ettn Makbuzun ETTN'i.
   * @param options `signed: true` imzalı sürümün adresini üretir; varsayılan
   *   `false`.
   * @returns PDF indirecek tam adres.
   * @throws {EArsivAuthError} Oturum açık değilse — URL token olmadan
   *   kurulamaz.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const url = client.getSelfEmployedReceiptPdfUrl('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * // CANLI token taşır: günlüğe yazmayın, paylaşmayın.
   * console.log(url.includes('belgeTip='))
   * ```
   */
  getSelfEmployedReceiptPdfUrl(ettn: string, options?: DocumentOptions): string {
    return this.documents.getDownloadUrl(ettn, {
      ...options,
      documentType: DocumentType.SELF_EMPLOYED_RECEIPT,
    })
  }

  // — Kullanıcı —

  /**
   * e-Arşiv'de kayıtlı firma bilgilerini okur.
   *
   * @returns Portalın kullanıcı ekranındaki tüm alanların İngilizce adlı
   *   karşılığı. Portal boş bıraktığı alanları boş string olarak döndürür;
   *   hiçbir alan `undefined` olmaz.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const info = await client.getUserInfo()
   * console.log(info.title, info.taxOffice, info.city)
   * ```
   */
  async getUserInfo(): Promise<UserInfo> {
    return this.users.getUserInfo()
  }

  /**
   * Firma bilgilerini KISMİ olarak günceller.
   *
   * Portal kaydetme yükünün TAMAMINI bekler ve eksik gönderilen alanları
   * SİLER; bu yüzden yöntem önce mevcut bilgileri okur (bir ek portal isteği)
   * ve yamayı onun üzerine yazar. Değeri açıkça `undefined` olan anahtarlar
   * yok sayılır — aksi halde o alan portalda silinirdi.
   *
   * @param patch Yalnızca değiştirmek istediğiniz alanlar. `taxOrIdentityNumber`
   *   SALT OKUNURDUR: yamada verilse bile mevcut değer korunur. Bir alanı
   *   BOŞALTMAK için `undefined` değil, boş string (`''`) gönderin.
   * @returns Portalın döndürdüğü başarı mesajı.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal kaydetmeyi reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const message = await client.updateUserInfo({
   *   email: 'muhasebe@ornek.test',
   *   phone: '02161234567',
   *   // Alanı boşaltmak için boş string; undefined yok sayılır.
   *   fax: '',
   * })
   * console.log(message)
   * ```
   */
  async updateUserInfo(patch: Partial<UserInfo>): Promise<string> {
    return this.users.updateUserInfo(patch)
  }

  /**
   * VKN veya TCKN'den ünvan ve vergi dairesi sorgular (sicil/MERNİS).
   *
   * Fatura kesmeden önce alıcı bilgisini doğrulamak için kullanışlıdır.
   *
   * @param taxOrIdentityNumber Sorgulanacak VKN (10 hane) veya TCKN
   *   (11 hane); yalnızca rakam.
   * @returns `title`, `firstName`, `lastName`, `taxOffice` ve portalın ham
   *   yanıtını taşıyan `raw`.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Numara bulunamazsa veya portal isteği
   *   reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const company = await client.getCompanyInfo('1111111111')
   * console.log(company.title, company.taxOffice)
   * ```
   */
  async getCompanyInfo(taxOrIdentityNumber: string): Promise<CompanyInfo> {
    return this.users.getCompanyInfo(taxOrIdentityNumber)
  }

  // — İmzalama —

  /**
   * Portalda kayıtlı cep telefonu numarasını sorgular.
   *
   * DİKKAT: imzalama komutlarına TEST ortamı yetki vermiyor; bu akış yalnızca
   * gerçek hesapla çalışır. Test ortamında portal bu komutu "Bu işlem için
   * yetkiniz yok" ile reddeder ve bu KALICI bir izin kısıtlamasıdır, bayat
   * token değildir.
   *
   * @returns Kayıtlı numara; portal alanı boş bırakırsa boş string.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi gerçekten dolmuşsa.
   * @throws {EArsivApiError} Portal komutu reddederse — test ortamında
   *   BEKLENEN durum budur.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   *
   * console.log('Kayıtlı numara:', await client.getPhoneNumber())
   * ```
   */
  async getPhoneNumber(): Promise<string> {
    return this.signing.getPhoneNumber()
  }

  /**
   * İmzalama için SMS doğrulama kodu gönderir.
   *
   * @param options `phoneNumber` verilmezse portaldan kayıtlı numara ayrıca
   *   sorgulanır (bir ek portal isteği).
   * @returns Portalın ürettiği `operationId` ve kodun gönderildiği
   *   `phoneNumber`. `operationId` doğrulama adımına aynen geri verilir.
   * @throws {EArsivApiError} Portal işlem kimliği (`oid`) döndürmezse veya
   *   komutu reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   *
   * const challenge = await client.sendSmsCode({ phoneNumber: '5551112233' })
   * console.log(challenge.operationId)
   * ```
   */
  async sendSmsCode(options?: SendSmsOptions): Promise<SmsChallenge> {
    return this.signing.sendSmsCode(options)
  }

  /**
   * Kodu doğrular ve faturaları imzalar. Başarısız olursa `EArsivApiError`
   * fırlatır.
   *
   * Dönüş değeri YOKTUR ve bu bilinçlidir: `boolean` döndürmek, dönüşü
   * yoksayan bir çağıranın faturalarının imzalandığına inanmasına izin
   * verirdi. Sessizce başarısız olma yolu yoktur — çağrı dönerse imzalama
   * gerçekleşmiştir.
   *
   * @param input `code` SMS ile gelen doğrulama kodu, `operationId`
   *   `sendSmsCode` sonucundaki kimlik, `invoices` imzalanacak faturaların
   *   ÖZET SATIRLARIDIR (listeleme yöntemlerinden dönen nesneler doğrudan
   *   verilebilir). Liste boş olamaz.
   * @returns İmzalama başarıyla tamamlandığında çözülen söz.
   * @throws {EArsivValidationError} `invoices` boşsa. Ağa çıkılmaz.
   * @throws {EArsivApiError} Kod reddedilirse veya portal imzalamayı
   *   tamamlayamazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'production' })
   * await client.login({ username: '1111111111', password: 'gizli' })
   *
   * const challenge = await client.sendSmsCode()
   * const drafts = await client.listDrafts(new Date(), new Date())
   *
   * await client.verifySmsCode({
   *   code: '123456',
   *   operationId: challenge.operationId,
   *   invoices: drafts,
   * })
   * console.log('Faturalar imzalandı.')
   * ```
   */
  async verifySmsCode(input: VerifySmsInput): Promise<void> {
    return this.signing.verifySmsCode(input)
  }

  // — İptal / itiraz —

  /**
   * KENDİ kestiğiniz bir belge için iptal talebi açar.
   *
   * Talep yalnızca ONAYLANMIŞ (imzalanmış) bir belge için ve belge başına BİR
   * KEZ açılabilir; koşul sağlanmazsa portal iş kuralı hatası döndürür. Test
   * ortamındaki taslaklar onaysız olduğu için orada bu çağrı beklenen şekilde
   * hata verir; akışın kendisi doğrudur.
   *
   * @param input `ettn` belgenin kimliği, `reason` iptal gerekçesi (portal boş
   *   bırakılmasına izin vermez). `approvalStatus` varsayılan `'Onaylandı'`,
   *   `documentType` varsayılan `'FATURA'`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} `ettn` veya `reason` boşsa. Ağa çıkılmaz.
   * @throws {EArsivApiError} Belge onaysızsa, talep zaten açılmışsa veya
   *   portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const message = await client.createCancellationRequest({
   *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *   reason: 'Fatura yanlış mükellefe düzenlendi.',
   * })
   * console.log(message)
   * ```
   */
  async createCancellationRequest(input: CancellationRequestInput): Promise<string> {
    return this.disputes.createCancellationRequest(input)
  }

  /**
   * KENDİ düzenlediğiniz bir belgeye itiraz talebi açar (yedi alanlı yük).
   *
   * Adınıza düzenlenmiş bir belgeye itiraz için
   * `createObjectionRequestForIncoming` kullanın — portal bu iki durum için
   * FARKLI yükler ve farklı ekran adları bekler.
   *
   * @param input `ettn` belgenin kimliği; `method` tebliğ yöntemi (`'NOTER'`,
   *   `'TAAHHUTLU_MEKTUP'`, `'TELGRAF'`, `'KEP'`); `referenceDocumentId`
   *   itiraz tebligatının belge sayısı; `referenceDocumentDate` tebligat
   *   tarihi (`Date` ya da `dd/MM/yyyy`, `dd-MM-yyyy`, `yyyy-MM-dd`);
   *   `reason` itiraz gerekçesi. `approvalStatus` varsayılan `'Onaylandı'`,
   *   `documentType` varsayılan `'FATURA'`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} `ettn`, `referenceDocumentId`,
   *   `referenceDocumentDate` veya `reason` boşsa.
   * @throws {EArsivApiError} Portal iş kuralıyla reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeMethod, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const message = await client.createObjectionRequest({
   *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *   method: DisputeMethod.NOTARY,
   *   referenceDocumentId: '2026/1234',
   *   referenceDocumentDate: '05/09/2026',
   *   reason: 'Hizmet teslim edilmedi.',
   * })
   * console.log(message)
   * ```
   */
  async createObjectionRequest(input: ObjectionRequestInput): Promise<string> {
    return this.disputes.createObjectionRequest(input)
  }

  /**
   * Adınıza düzenlenmiş (portal veya entegratör) bir belgeye itiraz talebi
   * açar — spec §9.2'nin belgelediği asıl kullanım durumu.
   *
   * Portalın alıcı ekranlarının gönderdiği ON BİR alanlı yükün karşılığıdır;
   * `createObjectionRequest`'in yedi alanlı yüküyle KARIŞTIRILMAMALIDIR.
   *
   * @param input `ObjectionRequestInput`'un tüm alanlarına EK OLARAK dördü
   *   birlikte zorunludur: `invoiceOid` (belgenin portal içi kaydı — gelen
   *   belge listesi satırından alınır), `totalAmount` (belgenin toplam tutarı,
   *   LİRA cinsinden), `sellerTaxOrIdentityNumber` (belgeyi düzenleyen
   *   satıcının VKN/TCKN'i) ve `documentNumber` (belge numarası).
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} Ortak yedi alandan biri veya dört ek
   *   alandan biri boş/geçersizse (`totalAmount` sonlu ve negatif olmayan bir
   *   sayı olmalıdır).
   * @throws {EArsivApiError} Portal iş kuralıyla reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeMethod, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const message = await client.createObjectionRequestForIncoming({
   *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *   invoiceOid: '4021',
   *   totalAmount: 1_200,
   *   sellerTaxOrIdentityNumber: '1111111111',
   *   documentNumber: 'EAR2026000000123',
   *   method: DisputeMethod.KEP,
   *   referenceDocumentId: '2026/1234',
   *   referenceDocumentDate: new Date(2026, 8, 5),
   *   reason: 'Sipariş edilmemiş hizmet faturalandı.',
   * })
   * console.log(message)
   * ```
   */
  async createObjectionRequestForIncoming(input: IncomingObjectionRequestInput): Promise<string> {
    return this.disputes.createObjectionRequestForIncoming(input)
  }

  /**
   * SİZE GELEN iptal/itiraz taleplerini listeler.
   *
   * @param from Aralığın başlangıç tarihi; `Date` ya da `dd/MM/yyyy`,
   *   `dd-MM-yyyy`, `yyyy-MM-dd` biçiminde metin.
   * @param to Aralığın bitiş tarihi; aynı biçimler.
   * @returns Talep satırları. `kind` `'0'` iptal / `'1'` itiraz; `status`
   *   `'0'` oluştu, `'1'` kabul, `'2'` ret, `'3'` iptal; `method` yalnızca
   *   itirazlarda doludur.
   * @throws {EArsivValidationError} Tarih biçimi tanınmazsa.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { DisputeKind, DisputeStatus, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const requests = await client.listDisputeRequests('01/09/2026', '30/09/2026')
   * const bekleyen = requests.filter((request) => request.status === DisputeStatus.CREATED)
   * for (const request of bekleyen) {
   *   console.log(request.documentNumber, request.kind === DisputeKind.CANCELLATION ? 'iptal' : 'itiraz')
   * }
   * ```
   */
  async listDisputeRequests(from: DateInput, to: DateInput): Promise<DisputeRequest[]> {
    return this.disputes.listRequests(from, to)
  }

  /**
   * Gelen bir talebi kabul eder veya gerekçeyle reddeder.
   *
   * @param input `disputeId` `listDisputeRequests` satırındaki talep kimliği;
   *   `answer` `DisputeAnswer.ACCEPT` (`'1'`) ya da `DisputeAnswer.REJECT`
   *   (`'2'`); `rejectionReason` YALNIZCA ret cevabında zorunludur;
   *   `documentType` varsayılan `'FATURA'`.
   * @returns Portalın döndürdüğü durum mesajı.
   * @throws {EArsivValidationError} `disputeId` boşsa veya ret cevabında
   *   gerekçe verilmemişse. Ağa çıkılmaz.
   * @throws {EArsivApiError} Portal isteği reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { DisputeAnswer, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const [request] = await client.listDisputeRequests(new Date(), new Date())
   * if (request !== undefined) {
   *   await client.respondToDisputeRequest({
   *     disputeId: request.disputeId,
   *     answer: DisputeAnswer.REJECT,
   *     rejectionReason: 'Belge doğru düzenlenmiştir.',
   *   })
   * }
   * ```
   */
  async respondToDisputeRequest(input: DisputeResponseInput): Promise<string> {
    return this.disputes.respondToRequest(input)
  }
}
