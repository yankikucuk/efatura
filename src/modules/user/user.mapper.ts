import type { CompanyInfo, UserInfo } from './user.types.js'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Portal yanıtını İngilizce alanlı `UserInfo` nesnesine çevirir. */
export function toUserInfo(raw: Record<string, unknown>): UserInfo {
  return {
    taxOrIdentityNumber: str(raw.vknTckn),
    title: str(raw.unvan),
    firstName: str(raw.ad),
    lastName: str(raw.soyad),
    registryNumber: str(raw.sicilNo),
    mersisNumber: str(raw.mersisNo),
    taxOffice: str(raw.vergiDairesi),
    street: str(raw.cadde),
    buildingName: str(raw.apartmanAdi),
    buildingNumber: str(raw.apartmanNo),
    doorNumber: str(raw.kapiNo),
    town: str(raw.kasaba),
    district: str(raw.ilce),
    city: str(raw.il),
    postalCode: str(raw.postaKodu),
    country: str(raw.ulke),
    phone: str(raw.telNo),
    fax: str(raw.faksNo),
    email: str(raw.ePostaAdresi),
    website: str(raw.webSitesiAdresi),
    businessCenter: str(raw.isMerkezi),
  }
}

/** `UserInfo` nesnesini portalın kaydetme yüküne çevirir. */
export function toPortalUserInfo(info: UserInfo): Record<string, unknown> {
  return {
    vknTckn: info.taxOrIdentityNumber,
    unvan: info.title,
    ad: info.firstName,
    soyad: info.lastName,
    sicilNo: info.registryNumber,
    mersisNo: info.mersisNumber,
    vergiDairesi: info.taxOffice,
    cadde: info.street,
    apartmanAdi: info.buildingName,
    apartmanNo: info.buildingNumber,
    kapiNo: info.doorNumber,
    kasaba: info.town,
    ilce: info.district,
    il: info.city,
    postaKodu: info.postalCode,
    ulke: info.country,
    telNo: info.phone,
    faksNo: info.fax,
    ePostaAdresi: info.email,
    webSitesiAdresi: info.website,
    isMerkezi: info.businessCenter,
  }
}

/** VKN sorgusu sonucunu eşler. */
export function toCompanyInfo(raw: Record<string, unknown>): CompanyInfo {
  return {
    title: str(raw.unvan),
    firstName: str(raw.ad),
    lastName: str(raw.soyad),
    taxOffice: str(raw.vergiDairesi),
    raw,
  }
}
