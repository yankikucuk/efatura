import { EArsivError } from './base.error.js'

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
 */
export class EArsivPortalDefectError extends EArsivError {
  readonly kind = 'portal-defect'
  readonly command: string | undefined
  readonly portalMessage: string | undefined

  constructor(message: string, context: PortalDefectContext = {}) {
    super(message, context.cause === undefined ? undefined : { cause: context.cause })
    this.command = context.command
    this.portalMessage = context.portalMessage
  }
}
