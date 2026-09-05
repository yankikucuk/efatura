export interface UserInfo {
  /** Salt okunur; portal bu alanın değiştirilmesine izin vermez. */
  taxOrIdentityNumber: string
  title: string
  firstName: string
  lastName: string
  registryNumber: string
  mersisNumber: string
  taxOffice: string
  street: string
  buildingName: string
  buildingNumber: string
  doorNumber: string
  town: string
  district: string
  city: string
  postalCode: string
  country: string
  phone: string
  fax: string
  email: string
  website: string
  businessCenter: string
}

/** `SICIL_VEYA_MERNISTEN_BILGILERI_GETIR` sonucu. */
export interface CompanyInfo {
  title: string
  firstName: string
  lastName: string
  taxOffice: string
  /** Portalın ham yanıtı; eşlemede kapsanmayan alanlar için. */
  raw: Record<string, unknown>
}
