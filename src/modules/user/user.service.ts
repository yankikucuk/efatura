import { Command, PageName } from '../../constants/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { toCompanyInfo, toPortalUserInfo, toUserInfo } from './user.mapper.js'
import type { CompanyInfo, UserInfo } from './user.types.js'

/** Firma bilgisi okuma/güncelleme ve VKN sorgulama. */
export class UserService {
  constructor(private readonly gateway: DispatchGateway) {}

  /** e-Arşiv'de kayıtlı firma bilgileri. */
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
   */
  async updateUserInfo(patch: Partial<UserInfo>): Promise<string> {
    const current = await this.getUserInfo()
    // vknTckn salt okunur; yamadan gelse bile mevcut değer korunur.
    const merged: UserInfo = {
      ...current,
      ...patch,
      taxOrIdentityNumber: current.taxOrIdentityNumber,
    }
    return this.gateway.call<string>(
      Command.SAVE_USER_INFO,
      PageName.USER,
      toPortalUserInfo(merged),
    )
  }

  /** VKN veya TCKN'den ünvan ve vergi dairesi sorgular. */
  async getCompanyInfo(taxOrIdentityNumber: string): Promise<CompanyInfo> {
    const raw = await this.gateway.call<Record<string, unknown>>(
      Command.GET_COMPANY_INFO,
      PageName.INVOICE_FORM,
      { vknTcknn: taxOrIdentityNumber },
    )
    return toCompanyInfo(raw)
  }
}
