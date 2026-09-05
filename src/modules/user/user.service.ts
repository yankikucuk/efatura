import { Command, PageName } from '../../constants/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { toCompanyInfo, toPortalUserInfo, toUserInfo } from './user.mapper.js'
import type { CompanyInfo, UserInfo } from './user.types.js'

/**
 * Firma bilgisi okuma/güncelleme ve VKN sorgulama.
 *
 * `EArsivClient` bunu kendisi kurar; doğrudan örneklemeniz yalnızca kendi
 * servis birleşiminizi kuracaksanız gerekir.
 *
 * @example Tek başına kullanmak
 * ```ts
 * import {
 *   AuthService,
 *   DispatchGateway,
 *   HttpClient,
 *   resolveClientOptions,
 *   UserService,
 * } from 'efatura'
 *
 * const options = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * const auth = new AuthService(http, options)
 * await auth.loginWithTestUser()
 *
 * const users = new UserService(new DispatchGateway(http, auth))
 * console.log((await users.getUserInfo()).title)
 * ```
 */
export class UserService {
  /**
   * @param gateway Komutları gönderecek dispatch geçidi; token'ı o taşır.
   */
  constructor(private readonly gateway: DispatchGateway) {}

  /**
   * e-Arşiv'de kayıtlı firma bilgileri.
   *
   * @returns Portalın kullanıcı ekranındaki tüm alanların İngilizce adlı
   *   karşılığı. Portal boş bıraktığı alanları boş string döndürür; hiçbir
   *   alan `undefined` olmaz.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal isteği reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   * console.log((await client.getUserInfo()).taxOffice)
   * ```
   */
  async getUserInfo(): Promise<UserInfo> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_USER_INFO,
      PageName.USER,
      {},
    )
    return toUserInfo(raw)
  }

  /**
   * Firma bilgilerini kısmi olarak günceller.
   *
   * Portal kaydetme yükünün TAMAMINI bekliyor; eksik gönderilen alanları
   * siler. Bu yüzden önce mevcut bilgiler okunur ve yama üzerine yazılır.
   *
   * İKİ portal isteği yapar: önce oku, sonra birleştirilmiş yükü kaydet.
   *
   * @param patch Yalnızca değiştirilecek alanlar. `taxOrIdentityNumber` SALT
   *   OKUNURDUR — yamada verilse bile mevcut değer korunur. Değeri açıkça
   *   `undefined` olan anahtarlar YOK SAYILIR; bir alanı BOŞALTMAK için boş
   *   string (`''`) gönderin.
   * @returns Portalın döndürdüğü başarı mesajı.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Portal okumayı ya da kaydetmeyi reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * // Yalnızca e-posta değişir; diğer alanlar mevcut değerleriyle korunur.
   * console.log(await client.updateUserInfo({ email: 'muhasebe@ornek.test' }))
   * ```
   */
  async updateUserInfo(patch: Partial<UserInfo>): Promise<string> {
    const current = await this.getUserInfo()

    // Açık `undefined` taşıyan anahtarları atıyoruz: spread bunları mevcut
    // değerin üzerine yazar, alan portala boş gider ve silinir — oku-birleştir
    // adımının tam olarak engellemek için var olduğu hata.
    // exactOptionalPropertyTypes TS tarafında böyle bir yama nesnesi
    // kurulmasını engelliyor ama düz JS tüketicisini ya da dış veriden
    // dinamik kurulan yamayı engellemiyor.
    const defined = Object.fromEntries(
      Object.entries(patch as Record<string, unknown>).filter(([, value]) => value !== undefined),
    ) as Partial<UserInfo>

    // vknTckn salt okunur; yamadan gelse bile mevcut değer korunur.
    const merged: UserInfo = {
      ...current,
      ...defined,
      taxOrIdentityNumber: current.taxOrIdentityNumber,
    }
    return this.gateway.call<string>(
      Command.SAVE_USER_INFO,
      PageName.USER,
      toPortalUserInfo(merged),
    )
  }

  /**
   * VKN veya TCKN'den ünvan ve vergi dairesi sorgular.
   *
   * @param taxOrIdentityNumber Sorgulanacak VKN (10 hane) veya TCKN
   *   (11 hane); yalnızca rakam. Portal `vknTcknn` alanına gönderilir
   *   (portalın kendi yazımı, iki `n` ile).
   * @returns `title`, `firstName`, `lastName`, `taxOffice` ve portalın ham
   *   yanıtını taşıyan `raw`.
   * @throws {EArsivAuthError} Oturum yoksa veya süresi dolmuşsa.
   * @throws {EArsivApiError} Numara bulunamazsa veya portal reddederse.
   *
   * @example
   * ```ts
   * import { EArsivClient } from 'efatura'
   *
   * const client = new EArsivClient({ environment: 'test' })
   * await client.loginWithTestUser()
   *
   * const company = await client.getCompanyInfo('1111111111')
   * console.log(company.title, company.taxOffice)
   * ```
   */
  async getCompanyInfo(taxOrIdentityNumber: string): Promise<CompanyInfo> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_COMPANY_INFO,
      PageName.INVOICE_FORM,
      { vknTcknn: taxOrIdentityNumber },
    )
    return toCompanyInfo(raw)
  }
}
