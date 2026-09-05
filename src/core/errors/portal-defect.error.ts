import { EArsivError } from './base.error.js'

/**
 * `EArsivPortalDefectError`'un taşıdığı bağlam. Üç alanın da verilmesi
 * opsiyoneldir.
 *
 * @example
 * ```ts
 * import { Command, EArsivPortalDefectError } from '@yankikucuk/efatura'
 * import type { PortalDefectContext } from '@yankikucuk/efatura'
 *
 * const context: PortalDefectContext = {
 *   command: Command.SHOW_INVOICE,
 *   portalMessage: 'String index out of range: 4',
 * }
 * const error = new EArsivPortalDefectError('Portal gösterimi bozuk.', context)
 * console.log(error.command, error.portalMessage)
 * ```
 */
export interface PortalDefectContext {
  /** Kusurun ortaya çıktığı portal komutu. */
  command?: string
  /** Portalın döndürdüğü ham hata metni — kusurun kanıtı. */
  portalMessage?: string
  /** Kusuru ortaya çıkaran orijinal hata; yutulmaz. */
  cause?: unknown
}

/**
 * PORTALIN KENDİ kusuru yüzünden desteklenemeyen bir işlem.
 *
 * `EArsivValidationError`'dan (çağıran yanlış girdi verdi) ve
 * `EArsivApiError`'dan (portal isteği iş kuralıyla reddetti) KASITLI olarak
 * ayrıdır: burada çağıranın yapabileceği hiçbir şey yoktur ve kütüphanenin
 * de düzeltebileceği bir şey yoktur. Bu ayrımın amacı, kullanıcının hatayı
 * kendi kullanımında araması için harcayacağı zamanı ortadan kaldırmaktır.
 *
 * Mesaj her zaman şunları içerir: neyin bozuk olduğu, portalın kendi hata
 * metni, bunun neden istemci tarafında çözülemediği ve varsa çalışan bir
 * alternatif.
 *
 * Bilinen iki kaynağı vardır:
 *
 * 1. `getSelfEmployedReceiptHtml` / `selfEmployedReceiptToPdf` — HER ZAMAN,
 *    ağa hiç çıkmadan. Serbest Meslek Makbuzunun HTML gösterimi portalda
 *    bozuktur.
 * 2. `getInvoiceHtml` / `toPdf` / `getProducerReceiptHtml` — portal
 *    `"String index out of range"` istisnasını sızdırdığında. Bu metnin İKİ
 *    ayrı sebebi vardır ve portal ikisini AYIRT ETMEZ: ETTN bulunamadı ya da
 *    biçimi hatalı, YA DA ETTN bir Serbest Meslek Makbuzuna ait. Önce
 *    ETTN'inizi doğrulayın.
 *
 * @example
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
 *   console.error('Komut:', error.command)
 *   console.error('Portalın kendi metni:', error.portalMessage)
 *   // Çalışan alternatif:
 *   console.log(await client.getSelfEmployedReceipt(ettn))
 * }
 * ```
 */
export class EArsivPortalDefectError extends EArsivError {
  /** Her zaman `'portal-defect'`. */
  readonly kind = 'portal-defect'
  /** Kusurun ortaya çıktığı portal komutu; bilinmiyorsa `undefined`. */
  readonly command: string | undefined
  /** Portalın ham hata metni — kusurun kanıtı; yoksa `undefined`. */
  readonly portalMessage: string | undefined

  /**
   * @param message Kusuru, kanıtını ve varsa çalışan alternatifi anlatan
   *   metin. Kasıtlı olarak uzundur.
   * @param context Komut, portalın kendi metni ve kök neden; tamamı
   *   opsiyoneldir ve varsayılan olarak boş nesnedir.
   */
  constructor(message: string, context: PortalDefectContext = {}) {
    super(message, context.cause === undefined ? undefined : { cause: context.cause })
    this.command = context.command
    this.portalMessage = context.portalMessage
  }
}
