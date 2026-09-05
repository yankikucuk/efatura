/**
 * Portal `pageName` alanını sunucu tarafında doğruluyor; yanlış ekran adı
 * "Bu işlem için yetkiniz yok" hatasına yol açar.
 *
 * Her komut belirli bir ekran adıyla eşleşir; bu eşleşme servislerde
 * sabittir. Sabitler dışa açıktır çünkü `DispatchGateway` tek başına
 * kullanılabilir ve o zaman doğru ekran adının verilmesi çağırana kalır.
 *
 * @example Ham komut göndermek
 * ```ts
 * import {
 *   AuthService,
 *   Command,
 *   DispatchGateway,
 *   HttpClient,
 *   PageName,
 *   resolveClientOptions,
 * } from '@yankikucuk/efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const gateway = new DispatchGateway(http, auth)
 * const info = await gateway.call<Record<string, unknown>>(
 *   Command.GET_USER_INFO,
 *   PageName.USER,
 *   {},
 * )
 * console.log(info.unvan)
 * ```
 */
export const PageName = {
  /** `MAINTREEMENU` — ana menü; token sağlık probu bu ekranı kullanır. */
  MAIN_MENU: 'MAINTREEMENU',
  /** `RG_BASITFATURA` — fatura oluşturma ve VKN sorgulama ekranı. */
  INVOICE_FORM: 'RG_BASITFATURA',
  /** `RG_BASITTASLAKLAR` — interaktif fatura taslakları; silme de buradan yapılır. */
  INTERACTIVE_DRAFTS: 'RG_BASITTASLAKLAR',
  /** `RG_TASLAKLAR` — standart taslak listesi; belge gösterimi ve talepler burada. */
  DRAFTS: 'RG_TASLAKLAR',
  /** Müstahsil Makbuzu ekranı. */
  PRODUCER_RECEIPT: 'RG_MUSTAHSIL',
  /** Serbest Meslek Makbuzu ekranı. */
  SELF_EMPLOYED_RECEIPT: 'RG_SERBEST',
  /** `RG_ALICI_TASLAKLAR` — adıma kesilen belgeler ve onlara itiraz ekranı. */
  INCOMING_DRAFTS: 'RG_ALICI_TASLAKLAR',
  /** Entegratör (portal harici) adıma düzenlenen belgeler ekranı. */
  INCOMING_INTEGRATOR: 'RG_ALICI_ENTEGRATOR',
  /** `RG_IPTALITIRAZTASLAKLAR` — gelen iptal/itiraz talepleri ekranı. */
  DISPUTE_DRAFTS: 'RG_IPTALITIRAZTASLAKLAR',
  /** `RG_KULLANICI` — firma bilgileri ekranı; kendi ülke listesi vardır. */
  USER: 'RG_KULLANICI',
  /** `RG_SMSONAY` — SMS ile imzalama ekranı. */
  SMS_APPROVAL: 'RG_SMSONAY',
} as const

/**
 * {@link PageName} sabitlerinden türetilen birleşim tipi.
 *
 * @example
 * ```ts
 * import { PageName } from '@yankikucuk/efatura'
 * import type { PageNameValue } from '@yankikucuk/efatura'
 *
 * const page: PageNameValue = PageName.DRAFTS
 * console.log(page)
 * ```
 */
export type PageNameValue = (typeof PageName)[keyof typeof PageName]
