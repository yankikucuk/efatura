import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'

import { toPortalUserInfo, toUserInfo } from './user.mapper.js'

const raw = portalResponses.userInfo.data as unknown as Record<string, unknown>

describe('toUserInfo', () => {
  it('portal alanlarını İngilizce alanlara eşler', () => {
    expect(toUserInfo(raw)).toEqual({
      taxOrIdentityNumber: '3333333301',
      title: 'DENEME LISANS TICARET ANONIM SIRKETI',
      firstName: '',
      lastName: '',
      registryNumber: '33333301',
      mersisNumber: '0123456789012345',
      taxOffice: 'Sisli',
      street: 'Esentepe Mahallesi Test Caddesi',
      buildingName: 'Test Plaza',
      buildingNumber: '12',
      doorNumber: '3',
      town: '',
      district: 'Sisli',
      city: 'Istanbul',
      postalCode: '34394',
      country: 'Türkiye',
      phone: '2125550142',
      fax: '',
      email: 'deneme@ornek.test',
      website: '',
      businessCenter: 'Test Plaza',
    })
  })

  it('eksik alanlar boş string olur', () => {
    expect(toUserInfo({}).taxOrIdentityNumber).toBe('')
    expect(toUserInfo({}).city).toBe('')
  })
})

describe('toPortalUserInfo', () => {
  it('gidiş-dönüş TÜM alanları korur', () => {
    // Alanları tek tek listelemek 21 alandan 16'sını kapsıyordu ve testin
    // adı "tüm alanlar" diyordu. Tam gidiş-dönüş eşitliği, eşlemelerden
    // birinde bir alan düşerse ya da yer değiştirirse kesin olarak kırılır.
    const info = toUserInfo(raw)
    expect(toUserInfo(toPortalUserInfo(info))).toEqual(info)
  })

  it('portal alan adlarını doğru yazar', () => {
    expect(toPortalUserInfo(toUserInfo(raw))).toMatchObject({
      vknTckn: '3333333301',
      unvan: 'DENEME LISANS TICARET ANONIM SIRKETI',
      cadde: 'Esentepe Mahallesi Test Caddesi',
      apartmanAdi: 'Test Plaza',
      apartmanNo: '12',
      kapiNo: '3',
      ilce: 'Sisli',
      il: 'Istanbul',
      postaKodu: '34394',
      ulke: 'Türkiye',
      telNo: '2125550142',
      ePostaAdresi: 'deneme@ornek.test',
      vergiDairesi: 'Sisli',
      isMerkezi: 'Test Plaza',
      mersisNo: '0123456789012345',
      sicilNo: '33333301',
    })
  })
})
