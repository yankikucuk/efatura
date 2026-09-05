import { type ClientOptions, type EnvironmentName, resolveClientOptions } from '../config/index.js'
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
import { type DocumentOptions, DocumentService } from '../modules/document/index.js'
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
 */
export class EArsivClient {
  readonly environment: EnvironmentName

  private readonly auth: AuthService
  private readonly invoices: InvoiceService
  private readonly documents: DocumentService
  private readonly users: UserService
  private readonly signing: SigningService
  private readonly disputes: DisputeService
  private readonly producerReceipts: ProducerReceiptService
  private readonly selfEmployedReceipts: SelfEmployedReceiptService

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

  get token(): string | undefined {
    return this.auth.token
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated
  }

  /** Önceden alınmış bir token ile oturuma devam eder. */
  setToken(token: string): void {
    this.auth.setToken(token)
  }

  async login(credentials: Credentials): Promise<string> {
    return this.auth.login(credentials)
  }

  /** Yalnızca test ortamında; portal otomatik bir test kullanıcısı üretir. */
  async loginWithTestUser(): Promise<TestUserCredentials> {
    return this.auth.loginWithTestUser()
  }

  async logout(): Promise<void> {
    return this.auth.logout()
  }

  // — Fatura —

  async createDraft(input: InvoiceInput): Promise<CreatedInvoice> {
    return this.invoices.createDraft(input)
  }

  async listDrafts(
    from: DateInput,
    to: DateInput,
    options?: ListOptions,
  ): Promise<InvoiceSummary[]> {
    return this.invoices.listDrafts(from, to, options)
  }

  async listIncoming(from: DateInput, to: DateInput): Promise<InvoiceSummary[]> {
    return this.invoices.listIncoming(from, to)
  }

  /** Bir ENTEGRATÖR aracılığıyla (portalın kendisi değil) adınıza düzenlenmiş belgeleri listeler. */
  async listIncomingExternal(
    from: DateInput,
    to: DateInput,
    filters?: ListIncomingExternalFilters,
  ): Promise<IncomingExternalSummary[]> {
    return this.invoices.listIncomingExternal(from, to, filters)
  }

  async getInvoice(ettn: string): Promise<InvoiceDetail> {
    return this.invoices.getInvoice(ettn)
  }

  async cancelDraft(ettn: string, reason?: string, options?: CancelDraftOptions): Promise<void> {
    return this.invoices.cancelDraft(ettn, reason, options)
  }

  // — Belge —

  async getInvoiceHtml(ettn: string, options?: DocumentOptions): Promise<string> {
    return this.documents.getHtml(ettn, options)
  }

  /** Resmi belge paketi (ZIP): HTML + imzalı UBL-TR XML. */
  async downloadPackage(ettn: string, options?: DocumentOptions): Promise<Uint8Array> {
    return this.documents.downloadPackage(ettn, options)
  }

  getDownloadUrl(ettn: string, options?: DocumentOptions): string {
    return this.documents.getDownloadUrl(ettn, options)
  }

  /** Faturanın HTML gösterimini PDF'e çevirir. `puppeteer` kurulu olmalıdır. */
  async toPdf(ettn: string, options: ToPdfOptions = {}): Promise<Uint8Array> {
    const html = await this.documents.getHtml(ettn, options)
    return renderHtmlToPdf(html, options)
  }

  // — Müstahsil Makbuzu —

  /** Taslak müstahsil makbuzu oluşturur ve portalın atadığı ETTN'i çözer. */
  async createProducerReceipt(input: ProducerReceiptInput): Promise<CreatedProducerReceipt> {
    return this.producerReceipts.createReceipt(input)
  }

  /**
   * Müstahsil makbuzlarını listeler.
   *
   * Portal ayrı bir makbuz listeleme komutu sunmuyor; fatura ile aynı liste
   * bir ÜST KÜMEDİR ve sonuç `belgeTuru` ile süzülür.
   */
  async listProducerReceipts(from: DateInput, to: DateInput): Promise<ProducerReceiptSummary[]> {
    return this.producerReceipts.listReceipts(from, to)
  }

  async getProducerReceipt(ettn: string): Promise<ProducerReceiptDetail> {
    return this.producerReceipts.getReceipt(ettn)
  }

  /**
   * Müstahsil makbuzunun portal tarafından üretilen HTML gösterimi.
   *
   * Fatura ile AYNI portal komutunu kullanır ve çalışır (canlı doğrulandı
   * 2026-09-05, 51 KB HTML). Serbest meslek makbuzunda aynı komut portal
   * kusuru nedeniyle çalışmaz; bkz. `getSelfEmployedReceiptHtml`.
   */
  async getProducerReceiptHtml(ettn: string, options?: DocumentOptions): Promise<string> {
    return this.documents.getHtml(ettn, options)
  }

  /** Müstahsil makbuzunun HTML gösterimini PDF'e çevirir. `puppeteer` kurulu olmalıdır. */
  async producerReceiptToPdf(ettn: string, options: ToPdfOptions = {}): Promise<Uint8Array> {
    const html = await this.documents.getHtml(ettn, options)
    return renderHtmlToPdf(html, options)
  }

  // — Serbest Meslek Makbuzu —

  /** Taslak serbest meslek makbuzu oluşturur ve portalın atadığı ETTN'i çözer. */
  async createSelfEmployedReceipt(
    input: SelfEmployedReceiptInput,
  ): Promise<CreatedSelfEmployedReceipt> {
    return this.selfEmployedReceipts.createReceipt(input)
  }

  /** Serbest meslek makbuzlarını listeler (ÜST KÜME listesinden süzülür). */
  async listSelfEmployedReceipts(
    from: DateInput,
    to: DateInput,
  ): Promise<SelfEmployedReceiptSummary[]> {
    return this.selfEmployedReceipts.listReceipts(from, to)
  }

  async getSelfEmployedReceipt(ettn: string): Promise<SelfEmployedReceiptDetail> {
    return this.selfEmployedReceipts.getReceipt(ettn)
  }

  /**
   * DESTEKLENMEZ — portal kusuru. Her zaman `EArsivPortalDefectError`
   * fırlatır ve ağa hiç çıkmaz.
   *
   * Metot bilinçli olarak SİLİNMEDİ: silinseydi çağıran `getInvoiceHtml`'i
   * bir SMM ETTN'i ile denerdi ve portalın ham Java istisnasını
   * ("String index out of range: 4") kendi hatası sanardı. Buradaki hata
   * kusurun portalda olduğunu ve çalışan alternatifi açıkça söyler.
   */
  getSelfEmployedReceiptHtml(ettn: string): never {
    return this.selfEmployedReceipts.getHtml(ettn)
  }

  /** DESTEKLENMEZ — PDF, bozuk olan HTML gösterimi üzerine kuruludur. */
  selfEmployedReceiptToPdf(ettn: string): never {
    return this.selfEmployedReceipts.toPdf(ettn)
  }

  // — Kullanıcı —

  async getUserInfo(): Promise<UserInfo> {
    return this.users.getUserInfo()
  }

  async updateUserInfo(patch: Partial<UserInfo>): Promise<string> {
    return this.users.updateUserInfo(patch)
  }

  async getCompanyInfo(taxOrIdentityNumber: string): Promise<CompanyInfo> {
    return this.users.getCompanyInfo(taxOrIdentityNumber)
  }

  // — İmzalama —

  async getPhoneNumber(): Promise<string> {
    return this.signing.getPhoneNumber()
  }

  async sendSmsCode(options?: SendSmsOptions): Promise<SmsChallenge> {
    return this.signing.sendSmsCode(options)
  }

  /** Kodu doğrular ve faturaları imzalar. Başarısız olursa `EArsivApiError` fırlatır. */
  async verifySmsCode(input: VerifySmsInput): Promise<void> {
    return this.signing.verifySmsCode(input)
  }

  // — İptal / itiraz —

  async createCancellationRequest(input: CancellationRequestInput): Promise<string> {
    return this.disputes.createCancellationRequest(input)
  }

  async createObjectionRequest(input: ObjectionRequestInput): Promise<string> {
    return this.disputes.createObjectionRequest(input)
  }

  /** Adınıza düzenlenmiş (portal veya entegratör) bir belgeye itiraz talebi açar — spec §9.2. */
  async createObjectionRequestForIncoming(input: IncomingObjectionRequestInput): Promise<string> {
    return this.disputes.createObjectionRequestForIncoming(input)
  }

  async listDisputeRequests(from: DateInput, to: DateInput): Promise<DisputeRequest[]> {
    return this.disputes.listRequests(from, to)
  }

  async respondToDisputeRequest(input: DisputeResponseInput): Promise<string> {
    return this.disputes.respondToRequest(input)
  }
}
