/**
 * e-Arşiv'de kayıtlı firma bilgileri — portalın `RG_KULLANICI` ekranının
 * tüm alanları.
 *
 * Hiçbir alan opsiyonel DEĞİLDİR: portal doldurmadığı alanları boş string
 * olarak döndürür, bu yüzden okuma yolunda her alan her zaman bir stringtir.
 * Güncelleme kısmi yapılır (`updateUserInfo` bir `Partial<UserInfo>` alır).
 *
 * DİKKAT: bu ekranın ülke listesi fatura ekranlarınınkinden FARKLIDIR ve
 * adlar kesik değildir (`'Amerika Birleşik Devletleri'`); `Country`
 * sabitlerini bu alana doğrudan uygulamayın.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { UserInfo } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const info: UserInfo = await client.getUserInfo()
 * console.log(info.title, info.taxOffice, info.email)
 * ```
 */
export interface UserInfo {
  /** Salt okunur; portal bu alanın değiştirilmesine izin vermez. */
  taxOrIdentityNumber: string
  /** `unvan` — tüzel kişi ünvanı. */
  title: string
  /** `ad` */
  firstName: string
  /** `soyad` */
  lastName: string
  /** `sicilNo` — ticaret sicil numarası. */
  registryNumber: string
  /** `mersisNo` */
  mersisNumber: string
  /** `vergiDairesi` */
  taxOffice: string
  /** `cadde` — bulvar/cadde/sokak. */
  street: string
  /** `apartmanAdi` */
  buildingName: string
  /** `apartmanNo` */
  buildingNumber: string
  /** `kapiNo` */
  doorNumber: string
  /** `kasaba` */
  town: string
  /** `ilce` */
  district: string
  /** `il` */
  city: string
  /** `postaKodu` */
  postalCode: string
  /** `ulke` — kullanıcı ekranının kendi ülke listesinden. */
  country: string
  /** `telNo` */
  phone: string
  /** `faksNo` */
  fax: string
  /** `ePostaAdresi` */
  email: string
  /** `webSitesiAdresi` */
  website: string
  /** `isMerkezi` */
  businessCenter: string
}

/**
 * `SICIL_VEYA_MERNISTEN_BILGILERI_GETIR` sonucu.
 *
 * Tüzel kişide `title`, gerçek kişide `firstName`/`lastName` dolu gelir;
 * portalın döndürdüğü diğer her alan `raw` içindedir.
 *
 * @example
 * ```ts
 * import { EArsivClient } from '@yankikucuk/efatura'
 * import type { CompanyInfo } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const company: CompanyInfo = await client.getCompanyInfo('1111111111')
 * console.log(company.title || `${company.firstName} ${company.lastName}`)
 * ```
 */
export interface CompanyInfo {
  /** `unvan`; gerçek kişide boş olabilir. */
  title: string
  /** `ad` */
  firstName: string
  /** `soyad` */
  lastName: string
  /** `vergiDairesi` */
  taxOffice: string
  /** Portalın ham yanıtı; eşlemede kapsanmayan alanlar için. */
  raw: Record<string, unknown>
}
