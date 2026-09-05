import { describe, expect, it, vi } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import type { DispatchGateway } from '../../transport/index.js'

import { UserService } from './user.service.js'
import type { UserInfo } from './user.types.js'

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('UserService', () => {
  it('firma bilgilerini çeker', async () => {
    const call = vi.fn().mockResolvedValue(portalResponses.userInfo.data)
    const info = await new UserService(gatewayMock(call)).getUserInfo()

    expect(info.title).toBe('DENEME LISANS TICARET ANONIM SIRKETI')
    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_KULLANICI')
    expect(call.mock.calls[0]?.[2]).toEqual({})
  })

  it('güncellemede mevcut bilgiyi okuyup üzerine yazar', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(portalResponses.userInfo.data)
      .mockResolvedValueOnce('Bilgileriniz başarıyla kaydedilmiştir.')

    await new UserService(gatewayMock(call)).updateUserInfo({ website: 'https://ornek.test' })

    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(call.mock.calls[1]?.[0]).toBe('EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET')
    expect(payload.webSitesiAdresi).toBe('https://ornek.test')
    // Değiştirilmeyen alanlar korunmalı, aksi halde portal onları siler.
    expect(payload.unvan).toBe('DENEME LISANS TICARET ANONIM SIRKETI')
    expect(payload.vknTckn).toBe('3333333301')
  })

  it('çakışan vknTckn yamasında sunucudaki değeri korur', async () => {
    // Bu test olmadan user.service.ts'teki taxOrIdentityNumber override
    // satırı silinse bile suite yeşil kalırdı: diğer test yamada hiç
    // vknTckn göndermiyor, dolayısıyla düz spread de aynı sonucu verirdi.
    const call = vi
      .fn()
      .mockResolvedValueOnce({ vknTckn: '1234567890', unvan: 'ACME A.Ş.' })
      .mockResolvedValueOnce('kaydedildi')

    await new UserService(gatewayMock(call)).updateUserInfo({
      taxOrIdentityNumber: '9999999999',
      title: 'Yeni Ünvan',
    })

    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(payload.vknTckn).toBe('1234567890')
    expect(payload.unvan).toBe('Yeni Ünvan')
  })

  it('yamadaki açık undefined mevcut alanı silmez', async () => {
    // Düz JS tüketicisi veya dinamik kurulan yama bu şekli üretebilir.
    const call = vi
      .fn()
      .mockResolvedValueOnce({ vknTckn: '1234567890', unvan: 'ACME A.Ş.', il: 'İstanbul' })
      .mockResolvedValueOnce('kaydedildi')

    await new UserService(gatewayMock(call)).updateUserInfo({
      title: undefined,
      website: 'https://ornek.test',
    } as unknown as Partial<UserInfo>)

    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(payload.unvan).toBe('ACME A.Ş.')
    expect(payload.il).toBe('İstanbul')
    expect(payload.webSitesiAdresi).toBe('https://ornek.test')
  })

  it('VKN ile firma sorgular', async () => {
    const call = vi.fn().mockResolvedValue({ unvan: 'ACME A.Ş.', vergiDairesi: 'Şişli' })
    const result = await new UserService(gatewayMock(call)).getCompanyInfo('1234567890')

    expect(call.mock.calls[0]?.[0]).toBe('SICIL_VEYA_MERNISTEN_BILGILERI_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_BASITFATURA')
    expect(call.mock.calls[0]?.[2]).toEqual({ vknTcknn: '1234567890' })
    expect(result.title).toBe('ACME A.Ş.')
    expect(result.taxOffice).toBe('Şişli')
  })
})
