import type { ResolvedClientOptions } from '../config/index.js'
import { EArsivNetworkError } from '../core/index.js'

import type { EndpointPath } from './endpoints.js'
import { buildPortalHeaders } from './headers.js'
import { redactUrl } from './redact-url.js'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** 5xx geçicidir ve yeniden denenir; 4xx kalıcıdır ve denenmez. */
const isRetryableStatus = (status: number): boolean => status >= 500

/**
 * `HttpClient.postForm` seçenekleri.
 *
 * @example
 * ```ts
 * import { Endpoint, HttpClient, resolveClientOptions } from '@yankikucuk/efatura'
 * import type { PostFormOptions } from '@yankikucuk/efatura'
 *
 * const http = new HttpClient(resolveClientOptions({ environment: 'test' }))
 * // Salt okunur bir sorgu: yeniden denenmesi güvenli.
 * const options: PostFormOptions = { retryable: true }
 * const raw = await http.postForm(Endpoint.ESIGN, { assoscmd: 'kullaniciOner', rtype: 'json' }, options)
 * console.log(raw)
 * ```
 */
export interface PostFormOptions {
  /**
   * İstek yeniden denenebilir mi? VARSAYILAN: `false`.
   *
   * Güvenli taraf budur: bu bayrak açıkça `true` verilmediği sürece istek
   * TEK denenir. Bir zaman aşımı, sunucu isteği zaten işleyip yanıtı
   * gönderemeden fırlayabilir (bkz. C1); mutasyon niteliğindeki bir komutu
   * yeniden denemek, tekrarlanmış bir hukuki belge (mükerrer fatura) veya
   * tekrarlanmış bir durum değişikliği ile sonuçlanır. Yalnızca salt okunur
   * komutlar (`DispatchGateway` içinde `RETRYABLE_COMMANDS` ile belirlenir)
   * `true` göndermelidir.
   */
  retryable?: boolean
}

/**
 * Portalın iki endpoint ailesi için ince fetch sarmalayıcısı.
 *
 * Zaman aşımını, üstel geri çekilmeli yeniden denemeyi ve hata çevrimini
 * yönetir; portal ZARFINI çözmez — o `parsePortalResponse`'un işidir.
 *
 * Normalde `EArsivClient` bunu kendisi kurar; doğrudan örneklemeniz yalnızca
 * servisleri tek başına kullanacaksanız gerekir.
 *
 * @example
 * ```ts
 * import { HttpClient, resolveClientOptions } from '@yankikucuk/efatura'
 *
 * const http = new HttpClient(resolveClientOptions({ environment: 'test', timeoutMs: 10_000 }))
 * console.log(typeof http.postForm, typeof http.getBinary)
 * ```
 */
export class HttpClient {
  private readonly headers: Record<string, string>

  /**
   * @param options `resolveClientOptions()` ile üretilmiş, doğrulanmış
   *   yapılandırma. Başlıklar kurulumda bir kez üretilir ve tüm isteklerde
   *   yeniden kullanılır.
   */
  constructor(private readonly options: ResolvedClientOptions) {
    this.headers = buildPortalHeaders(options.baseUrl, options.userAgent)
  }

  /**
   * Form-urlencoded POST; yanıtı JSON olarak çözer.
   *
   * @param path Hedef uç nokta; `Endpoint` sabitlerinden biri.
   * @param fields Gövdeye `application/x-www-form-urlencoded` olarak
   *   kodlanacak alanlar. Değerlerin tamamı string olmalıdır — iç içe yapılar
   *   çağıran tarafından `JSON.stringify` ile düzleştirilir.
   * @param options `retryable` VARSAYILAN `false`'tur: bayrak açıkça `true`
   *   verilmedikçe istek TEK KEZ denenir. Yalnızca salt okunur komutlar
   *   `true` göndermelidir.
   * @returns Ayrıştırılmış JSON — portal zarfının kendisi. Zarf ÇÖZÜLMEZ;
   *   hata tespiti için `parsePortalResponse` kullanın.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa, zaman aşımı olursa,
   *   HTTP hata durumu dönerse veya yanıt JSON olarak ayrıştırılamazsa.
   *
   * @example
   * ```ts
   * import { Command, Endpoint, HttpClient, parsePortalResponse, resolveClientOptions } from '@yankikucuk/efatura'
   *
   * const http = new HttpClient(resolveClientOptions({ environment: 'test' }))
   * const raw = await http.postForm(
   *   Endpoint.LOGIN,
   *   { assoscmd: 'login', rtype: 'json', userid: '33333307', sifre: '1', sifre2: '1', parola: '1' },
   *   { retryable: true },
   * )
   * parsePortalResponse(raw, { command: Command.LOGIN, callId: 'login' })
   * console.log(raw)
   * ```
   */
  async postForm(
    path: EndpointPath,
    fields: Record<string, string>,
    options: PostFormOptions = {},
  ): Promise<unknown> {
    const url = `${this.options.baseUrl}${path}`
    const body = new URLSearchParams(fields).toString()
    const { response, attempts } = await this.send(
      url,
      { method: 'POST', headers: this.headers, body },
      options.retryable ?? false,
    )
    const text = await response.text()
    try {
      return JSON.parse(text) as unknown
    } catch (cause) {
      throw new EArsivNetworkError('Portal JSON olarak ayrıştırılamayan bir yanıt döndürdü.', {
        url: redactUrl(url),
        status: response.status,
        // Yapılandırılmış tavan değil, gerçekten yapılan deneme sayısı:
        // EArsivNetworkError.attempts alanı "toplam deneme sayısı" diye belgeli.
        attempts,
        cause,
      })
    }
  }

  /**
   * İkili GET; belge paketi indirmek için. Her zaman yeniden denenebilir:
   * idempotent bir okumadır.
   *
   * @param path Hedef uç nokta; pratikte `Endpoint.DOWNLOAD`.
   * @param query Sorgu dizesine kodlanacak alanlar — `token`, `ettn`,
   *   `belgeTip`, `onayDurumu`, `cmd`. Günlüklerde ve hata nesnesinde `token`
   *   GİZLENİR.
   * @returns İndirilen dosyanın ham baytları; ZIP olarak gelir.
   * @throws {EArsivNetworkError} Portala ulaşılamazsa, HTTP hata durumu
   *   dönerse ya da paket BOŞ gelirse (ETTN veya onay durumu hatalı olabilir).
   *
   * @example
   * ```ts
   * import { Command, DocumentType, Endpoint, HttpClient, resolveClientOptions } from '@yankikucuk/efatura'
   *
   * const http = new HttpClient(resolveClientOptions({ environment: 'test' }))
   * const zip = await http.getBinary(Endpoint.DOWNLOAD, {
   *   token: 'oturum-tokeni',
   *   ettn: '9c2f2b0f-2f4c-4e4f-9f4a-2b0f9c2f2b0f',
   *   belgeTip: DocumentType.INVOICE,
   *   onayDurumu: 'Onaylanmadı',
   *   cmd: Command.DOWNLOAD_DOCUMENT,
   * })
   * console.log(zip.byteLength)
   * ```
   */
  async getBinary(path: EndpointPath, query: Record<string, string>): Promise<Uint8Array> {
    const url = `${this.options.baseUrl}${path}?${new URLSearchParams(query).toString()}`
    const { response, attempts } = await this.send(
      url,
      { method: 'GET', headers: this.headers },
      true,
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) {
      // Boş gövde bu uç noktada portalın TEK hata sinyalidir: yanlış
      // `belgeTip`, bilinmeyen ETTN ve yanlış `onayDurumu` üçü de `HTTP 200`
      // + 0 bayt üretir, hiçbirinde hata metni gelmez (canlı doğrulandı
      // 2026-09-05). Bu yüzden mesaj bir TEŞHİS koyamaz, yalnızca üç
      // olasılığı sayabilir — ve belge TÜRÜNÜ saymak zorundadır: makbuz
      // indirmeyi yıllarca bozuk bırakan sebep tam olarak oydu ve mesaj
      // yalnızca "ETTN veya onay durumu" derken kullanıcıyı doğru yazdığı
      // ETTN'i kontrol etmeye gönderiyordu.
      throw new EArsivNetworkError(
        'Portal boş bir belge paketi döndürdü ve hata mesajı vermedi. Üç sebepten ' +
          'biri olabilir: (1) belge türü (`belgeTip`) belgenin gerçek türüyle ' +
          'uyuşmuyor — makbuzlar için downloadProducerReceiptPackage / ' +
          'downloadSelfEmployedReceiptPdf kullanın; (2) ETTN hatalı; (3) onay durumu ' +
          '(`signed`) hatalı.',
        { url: redactUrl(url), status: response.status, attempts },
      )
    }
    return bytes
  }

  /**
   * Zaman aşımı ve üstel geri çekilmeli yeniden deneme.
   * Yanıtla birlikte GERÇEKTEN yapılan deneme sayısını döndürür; çağıranlar
   * hata bağlamında bu sayıyı kullanır. `retryable` false ise TAM OLARAK bir
   * deneme yapılır (bkz. C1) — 5xx dahil, hiçbir koşulda ikinci istek atılmaz.
   */
  private async send(
    url: string,
    init: RequestInit,
    retryable: boolean,
  ): Promise<{ response: Response; attempts: number }> {
    const configured = this.options.retry
    const attempts = retryable ? configured.attempts : 1
    const backoffMs = configured.backoffMs
    let lastCause: unknown

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await this.options.fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.options.timeoutMs),
        })

        if (response.ok) return { response, attempts: attempt }

        if (!isRetryableStatus(response.status) || attempt === attempts) {
          throw new EArsivNetworkError(`Portal HTTP ${String(response.status)} döndürdü.`, {
            url: redactUrl(url),
            status: response.status,
            attempts: attempt,
          })
        }
        lastCause = new Error(`HTTP ${String(response.status)}`)
      } catch (cause) {
        // Kalıcı hatayı yeniden denemeden yukarı ilet.
        if (cause instanceof EArsivNetworkError) throw cause
        if (attempt === attempts) {
          throw new EArsivNetworkError('Portala ulaşılamadı.', {
            url: redactUrl(url),
            attempts: attempt,
            cause,
          })
        }
        lastCause = cause
      }

      this.options.logger.debug('Portal isteği yeniden deneniyor', {
        url: redactUrl(url),
        attempt,
        cause: String(lastCause),
      })
      await sleep(backoffMs * 2 ** (attempt - 1))
    }

    // Döngü her koşulda ya döner ya fırlatır; bu satır yalnızca tip güvenliği için.
    throw new EArsivNetworkError('Portala ulaşılamadı.', {
      url: redactUrl(url),
      attempts,
      cause: lastCause,
    })
  }
}
