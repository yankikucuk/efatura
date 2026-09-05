import type { ResolvedClientOptions } from '../../config/index.js'
import { ApprovalStatus, Command, DocumentType, PageName } from '../../constants/index.js'
import { EArsivApiError, EArsivPortalDefectError } from '../../core/index.js'
import {
  type DispatchGateway,
  Endpoint,
  type HttpClient,
  type TokenProvider,
} from '../../transport/index.js'

import type { DocumentOptions } from './document.types.js'

/**
 * Portalın belge gösteriminde sızdırdığı Java istisnası.
 *
 * Serbest meslek makbuzuna ait bir ETTN ile `EARSIV_PORTAL_FATURA_GOSTER`
 * çağrıldığında dönüyor (canlı doğrulandı 2026-09-05). Aynı komut fatura ve
 * müstahsil makbuzunda sorunsuz çalışıyor.
 */
const PORTAL_DEFECT_MESSAGE = /String index out of range/i

/**
 * Ham istisnayı, kullanıcıyı kendi kullanımını sorgulamaya itmeyen bir
 * hataya çevirir.
 *
 * `SelfEmployedReceiptService.getHtml`'deki mesajın kopyası DEĞİLDİR ve
 * öyle olmamalıdır: orada belge türü KESİN olarak bilinir ("bu belge türü
 * desteklenmiyor"), burada yalnızca SEMPTOM bilinir. Bu yüzden metin bir
 * teşhis değil, gözlemlenmiş bir eşleşme olarak yazıldı — ETTN gerçekten bir
 * SMM'ye ait değilse de yanıltmasın diye. Bu iki mesajı tek bir yardımcıda
 * birleştirmek, ikisinden birini yanlış yapardı.
 */
function showDocumentPortalDefect(ettn: string, cause: EArsivApiError): EArsivPortalDefectError {
  return new EArsivPortalDefectError(
    `Portal, ${ettn} belgesinin HTML gösteriminde bir iç hata (Java istisnası) döndürdü: ` +
      `"${cause.message}". Bu bir kullanım hatası DEĞİLDİR ve istemci tarafında ` +
      'düzeltilemez. Canlı olarak yalnızca Serbest Meslek Makbuzlarında gözlendi ' +
      '(2026-09-05); fatura ve müstahsil makbuzunda aynı komut sorunsuz çalışıyor. ' +
      'ETTN bir Serbest Meslek Makbuzuna aitse belgenin tüm verilerine ' +
      'getSelfEmployedReceipt(ettn) ile erişebilirsiniz.',
    { command: Command.SHOW_INVOICE, portalMessage: cause.message, cause },
  )
}

/** Belge görüntüleme ve indirme. İndirme `/download` GET endpoint'ini kullanır. */
export class DocumentService {
  constructor(
    private readonly gateway: DispatchGateway,
    private readonly http: HttpClient,
    private readonly tokens: TokenProvider,
    private readonly options: ResolvedClientOptions,
  ) {}

  /**
   * Belgenin portal tarafından üretilen HTML gösterimi.
   *
   * Fatura ve müstahsil makbuzu için çalışır. Serbest meslek makbuzunda
   * portal bir Java istisnası sızdırıyor; o metin yakalanıp
   * `EArsivPortalDefectError`'a çevrilir (bkz. `PORTAL_DEFECT_MESSAGE`).
   */
  async getHtml(ettn: string, options: DocumentOptions = {}): Promise<string> {
    try {
      return await this.gateway.call<string>(Command.SHOW_INVOICE, PageName.DRAFTS, {
        ettn,
        onayDurumu: this.approvalStatus(options),
      })
    } catch (error) {
      if (error instanceof EArsivApiError && PORTAL_DEFECT_MESSAGE.test(error.message)) {
        throw showDocumentPortalDefect(ettn, error)
      }
      throw error
    }
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
