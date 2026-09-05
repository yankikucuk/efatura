import type { ResolvedClientOptions } from '../../config/index.js'
import { ApprovalStatus, Command, DocumentType, PageName } from '../../constants/index.js'
import {
  type DispatchGateway,
  Endpoint,
  type HttpClient,
  type TokenProvider,
} from '../../transport/index.js'

import type { DocumentOptions } from './document.types.js'

/** Belge görüntüleme ve indirme. İndirme `/download` GET endpoint'ini kullanır. */
export class DocumentService {
  constructor(
    private readonly gateway: DispatchGateway,
    private readonly http: HttpClient,
    private readonly tokens: TokenProvider,
    private readonly options: ResolvedClientOptions,
  ) {}

  /** Faturanın portal tarafından üretilen HTML gösterimi. */
  async getHtml(ettn: string, options: DocumentOptions = {}): Promise<string> {
    return this.gateway.call<string>(Command.SHOW_INVOICE, PageName.DRAFTS, {
      ettn,
      onayDurumu: this.approvalStatus(options),
    })
  }

  /**
   * Resmi belge paketini indirir. ZIP içinde `<ettn>_f.html` ve imzalı
   * `<ettn>_f.xml` (UBL-TR) bulunur; PDF yoktur.
   */
  async downloadPackage(ettn: string, options: DocumentOptions = {}): Promise<Uint8Array> {
    return this.http.getBinary(Endpoint.DOWNLOAD, this.downloadQuery(ettn, options))
  }

  /**
   * İndirme adresini üretir; tarayıcıya veya harici indiriciye verilebilir.
   *
   * UYARI: dönen URL, geçerli oturumun CANLI token'ını sorgu dizesinde
   * (`token=...`) taşır — bu değer `HttpClient`'ın yaptığı gibi ASLA
   * gizlenmez (bkz. I1: gizleme yalnızca `EArsivNetworkError` ve günlükler
   * içindir). URL'yi bir tarayıcıya yapıştırırsanız token tarayıcı
   * geçmişinde ve — URL'ye giden herhangi bir isteğin `Referer` başlığında
   * — açığa çıkar. URL'yi yalnızca güvendiğiniz bir bağlamda kullanın ve
   * paylaşmayın.
   */
  getDownloadUrl(ettn: string, options: DocumentOptions = {}): string {
    const query = new URLSearchParams(this.downloadQuery(ettn, options)).toString()
    return `${this.options.baseUrl}${Endpoint.DOWNLOAD}?${query}`
  }

  private approvalStatus(options: DocumentOptions): string {
    return options.signed === true ? ApprovalStatus.APPROVED : ApprovalStatus.NOT_APPROVED
  }

  private downloadQuery(ettn: string, options: DocumentOptions): Record<string, string> {
    return {
      token: this.tokens.getToken(),
      ettn,
      belgeTip: DocumentType.INVOICE,
      onayDurumu: this.approvalStatus(options),
      cmd: Command.DOWNLOAD_DOCUMENT,
    }
  }
}
