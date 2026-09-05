import type { ResolvedClientOptions } from '../../config/index.js'
import { ApprovalStatus, Command, DocumentType, PageName } from '../../constants/index.js'
import { EArsivApiError, EArsivPortalDefectError } from '../../core/index.js'
import {
  type DispatchGateway,
  Endpoint,
  type HttpClient,
  type TokenProvider,
} from '../../transport/index.js'

import type { DocumentOptions, DownloadOptions } from './document.types.js'

/**
 * Portalın belge gösteriminde sızdırdığı Java istisnası.
 *
 * DİKKAT — bu metnin İKİ ayrı sebebi var ve portal ikisini AYIRT ETMİYOR
 * (her ikisi de canlı doğrulandı 2026-09-05):
 *
 * 1. ETTN portalda bulunamıyor ya da biçimi hatalı. Sıfır UUID
 *    (`00000000-...`), UUID olmayan bir metin (`not-a-uuid`) ve boş string —
 *    üçü de AYNI "String index out of range: 4" metnini üretti.
 * 2. ETTN geçerli bir Serbest Meslek Makbuzuna ait. Portalın SMM
 *    gösterimi bozuk; aynı komut fatura ve müstahsil makbuzunda çalışıyor.
 *
 * Metin tek başına hangisi olduğunu SÖYLEMEZ; bu yüzden çeviri de bir teşhis
 * koyamaz, yalnızca iki olasılığı sunar. "Bu bir kullanım hatası değildir"
 * demek, ETTN'ini yanlış yazan kullanıcıyı olmayan bir portal kusurunun
 * peşine gönderirdi.
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
      `"${cause.message}". Portal bu metni İKİ farklı durumda da üretiyor ve ` +
      'hangisi olduğunu söylemiyor: (1) ETTN portalda bulunamadı ya da biçimi ' +
      'hatalı — bilinmeyen bir UUID, hatalı yazılmış ya da boş bir değer aynı ' +
      'metni verir; (2) ETTN bir Serbest Meslek Makbuzuna ait — portalın SMM ' +
      'gösterimi bozuk, fatura ve müstahsil makbuzunda aynı komut çalışıyor ' +
      "(canlı doğrulandı 2026-09-05). ÖNCE ETTN'inizi doğrulayın; listeleme " +
      'metotlarından dönen değerle birebir aynı olmalı. ETTN doğruysa belge bir ' +
      'Serbest Meslek Makbuzudur: HTML gösterimi istemci tarafında düzeltilemez, ' +
      'ancak makbuza İKİ yoldan erişebilirsiniz — tüm verileri için ' +
      'getSelfEmployedReceipt(ettn), basılabilir RESMİ belge için ' +
      'downloadSelfEmployedReceiptPdf(ettn) (portal SMM indirmesinde ZIP değil ' +
      'doğrudan PDF döndürür).',
    { command: Command.SHOW_INVOICE, portalMessage: cause.message, cause },
  )
}

/**
 * Belge görüntüleme ve indirme. İndirme `/download` GET endpoint'ini kullanır.
 *
 * GÖSTERİM belge türünden bağımsızdır: aynı komut fatura ve müstahsil
 * makbuzunda çalışır. Serbest meslek makbuzunda portal bozuktur; istemci o
 * türü ayrı bir yolla (bkz. `SelfEmployedReceiptService.getHtml`) reddeder.
 *
 * İNDİRME ise DEĞİLDİR: sorgudaki `belgeTip` alanı belgenin türünü taşımak
 * zorundadır ve dönen format da türe göre değişir (bkz. `downloadPackage`).
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   DocumentService,
 *   HttpClient,
 *   resolveClientOptions,
 * } from '@yankikucuk/efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const documents = new DocumentService(new DispatchGateway(http, auth), http, auth, options)
 * const html = await documents.getHtml('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
 * console.log(html.length)
 * ```
 */
export class DocumentService {
  /**
   * @param gateway `dispatch` komutlarını gönderecek geçit (HTML gösterimi).
   * @param http İkili indirme için kullanılan HTTP istemcisi.
   * @param tokens İndirme URL'sine konacak token'ın kaynağı.
   * @param options Taban adresi (`baseUrl`) için çözülmüş yapılandırma.
   */
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
   *
   * @param ettn Belgenin ETTN'i; listeleme yöntemlerinden dönen değerle
   *   birebir aynı olmalıdır.
   * @param options `signed: true` imzalı (onaylanmış) sürümü ister;
   *   varsayılan `false`.
   * @returns Tam bir HTML belgesi (canlı portalda 47-55 KB).
   * @throws {EArsivPortalDefectError} Portal Java istisnası sızdırırsa. Metin
   *   İKİ durumu birden ifade eder: ETTN hatalı VEYA belge bir Serbest Meslek
   *   Makbuzu. Önce ETTN'i doğrulayın.
   * @throws {EArsivApiError} Portal isteği başka bir gerekçeyle reddederse.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   *
   * @example
   * ```ts
   * import { EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const html = await client.getInvoiceHtml('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f')
   * console.log(html.includes('<html'))
   * ```
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
   * Resmi belgeyi indirir. `options.documentType` ile belge TÜRÜ verilir;
   * varsayılan `FATURA`.
   *
   * DÖNEN FORMAT TÜRE GÖRE DEĞİŞİR (canlı doğrulandı 2026-09-05):
   *
   * | Belge türü | `belgeTip` | Format | Dosya adı |
   * | --- | --- | --- | --- |
   * | Fatura | `FATURA` | ZIP | `<ettn>_f.zip` |
   * | Müstahsil Makbuzu | `MÜSTAHSİL MAKBUZU` | ZIP | `<ettn>_m.zip` |
   * | Serbest Meslek Makbuzu | `SERBEST MESLEK MAKBUZU` | **PDF** | `<ettn>_s.pdf` |
   *
   * ZIP paketinin içeriği de türe göre adlandırılır: faturada `<ettn>_f.html`
   * ve imzalı `<ettn>_f.xml` (UBL-TR), müstahsilde `_m` ekiyle aynı çift.
   * ZIP'lerde PDF YOKTUR. Serbest meslek makbuzunda ise ZIP hiç yoktur;
   * portal doğrudan basılabilir resmî PDF'i (`%PDF-1.5`) döndürür — metodun
   * adı "paket" dese de o türde gelen şey bir PDF'tir. Bu yüzden facade'da
   * formatı adında söyleyen `downloadSelfEmployedReceiptPdf` bulunur; çağrı
   * yerinde hangi baytların geldiği belli olsun diye onu tercih edin.
   *
   * FORMATI `content-type` BAŞLIĞINDAN ÇIKARMAYIN: portal üç türde de
   * `application/json` yazıyor, YANILTICIDIR. Gerçek format yalnızca sihirli
   * baytlardan anlaşılır (`PK` / `%PDF`).
   *
   * DİKKAT: yanlış `belgeTip` SESSİZCE boş döner — makbuz ETTN'i +
   * `belgeTip=FATURA` portalda `HTTP 200` ve 0 bayt üretir, hata metni yoktur.
   * Bu, boş gövde nedeniyle `EArsivNetworkError`'a dönüşür; hata "ETTN hatalı"
   * der ama gerçek sebep yanlış TÜR olabilir.
   *
   * @param ettn Belgenin ETTN'i; listeleme yöntemlerinden dönen değerle
   *   birebir aynı olmalıdır.
   * @param options `documentType` belge türü (varsayılan `FATURA`),
   *   `signed: true` imzalı sürümü ister (varsayılan `false`).
   * @returns Dosyanın ham baytları: fatura ve müstahsilde ZIP, serbest meslek
   *   makbuzunda PDF.
   * @throws {EArsivNetworkError} Portal BOŞ gövde döndürürse (ETTN, belge
   *   TÜRÜ veya onay durumu hatalı olabilir) ya da portala ulaşılamazsa.
   * @throws {EArsivAuthError} Oturum açık değilse.
   *
   * @example Müstahsil makbuzunun ZIP paketini indirmek
   * ```ts
   * import { writeFile } from 'node:fs/promises'
   *
   * import { DocumentType, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const zip = await client.downloadPackage('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', {
   *   documentType: DocumentType.PRODUCER_RECEIPT,
   * })
   * await writeFile('makbuz.zip', zip)
   * ```
   */
  async downloadPackage(ettn: string, options: DownloadOptions = {}): Promise<Uint8Array> {
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
   *
   * Adres `downloadPackage` ile AYNI sorguyu kurar; dolayısıyla aynı format
   * tablosuna tabidir: `FATURA` ve `MÜSTAHSİL MAKBUZU` bir ZIP indirir,
   * `SERBEST MESLEK MAKBUZU` doğrudan bir PDF. Belge türü
   * `options.documentType` ile verilir (varsayılan `FATURA`); yanlış tür
   * portalda SESSİZCE boş yanıt üretir.
   *
   * @param ettn Belgenin ETTN'i.
   * @param options `documentType` belge türü (varsayılan `FATURA`),
   *   `signed: true` imzalı sürümün adresini üretir (varsayılan `false`).
   * @returns Tam indirme adresi. AĞA ÇIKMAZ; yalnızca URL kurar.
   * @throws {EArsivAuthError} Oturum açık değilse — URL token olmadan
   *   kurulamaz.
   *
   * @example
   * ```ts
   * import { DocumentType, EArsivClient } from '@yankikucuk/efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const url = client.getDownloadUrl('9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f', {
   *   documentType: DocumentType.PRODUCER_RECEIPT,
   *   signed: true,
   * })
   * // CANLI token taşır: günlüğe yazmayın, paylaşmayın.
   * console.log(url.includes('token='))
   * ```
   */
  getDownloadUrl(ettn: string, options: DownloadOptions = {}): string {
    const query = new URLSearchParams(this.downloadQuery(ettn, options)).toString()
    return `${this.options.baseUrl}${Endpoint.DOWNLOAD}?${query}`
  }

  private approvalStatus(options: DocumentOptions): string {
    return options.signed === true ? ApprovalStatus.APPROVED : ApprovalStatus.NOT_APPROVED
  }

  /**
   * `belgeTip` VARSAYILANI `FATURA`'dır, sabiti DEĞİL: alan bir zamanlar
   * sabit gönderiliyordu ve makbuz indirme bu yüzden hiç çalışmıyordu
   * (portal yanlış türde `HTTP 200` + 0 bayt döndürüyor, hata metni yok).
   * Varsayılan, tür vermeyen mevcut çağrıların davranışını korumak içindir.
   */
  private downloadQuery(ettn: string, options: DownloadOptions): Record<string, string> {
    return {
      token: this.tokens.getToken(),
      ettn,
      belgeTip: options.documentType ?? DocumentType.INVOICE,
      onayDurumu: this.approvalStatus(options),
      cmd: Command.DOWNLOAD_DOCUMENT,
    }
  }
}
