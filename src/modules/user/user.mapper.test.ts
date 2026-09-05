/**
 * Firma bilgisi kaydının portal alan adlarıyla İngilizce alanlar arasında
 * çevrilmesi.
 *
 * Bu eşleme 21 alanlıdır ve tek yönlü değil GİDİŞ-DÖNÜŞLÜ kullanılır:
 * `updateUserInfo` mevcut kaydı okur (`toUserInfo`), yamayı bindirir ve
 * tamamını geri yazar (`toPortalUserInfo`). Eşlemeden düşen bir alan bu yüzden
 * yalnızca "okunamaz" olmaz — kullanıcının portaldaki kaydından SİLİNİR.
 *
 * Round-trip testi, projede yakalanan yedi "adını taşıdığı davranışı
 * sabitlemeyen test" vakasının en öğreticisidir ve İKİ turda düzeltildi:
 *
 * 1. Test adı "TÜM alanları korur" diyordu ama `toMatchObject` listesi 21
 *    alandan yalnızca 16'sını sayıyordu; `ad`, `soyad`, `kasaba`, `faksNo` ve
 *    `webSitesiAdresi` hiç doğrulanmıyordu.
 * 2. Liste tam gidiş-dönüş eşitliğine çevrildi — ama GERÇEK fixture ile, ve
 *    hâlâ ayırt edici değildi: fixture'da tam o beş alan boş string ve boş
 *    değerde gidiş-dönüş hiçbir şey kanıtlamaz (`str()` düşen alan için de ''
 *    üretir). Ampirik olarak doğrulandı: `toPortalUserInfo`'dan `faksNo`
 *    silindiğinde test YEŞİL kalıyordu. Yani "daha titiz görünen" düzeltme tam
 *    olarak eski listenin atladığı beş alana karşı kördü.
 *
 * Bugünkü hâli her alana BENZERSİZ bir değer veren sentetik bir kayıt kullanır;
 * artık düşen ya da yer değiştiren HER alan eşitliği bozar (doğrulandı:
 * `kasaba` düşürülünce kırılıyor).
 *
 * Kimlik eşitliği tek başına yetmez: iki tarafta TUTARLI bir yanlış adlandırma
 * (ör. her ikisinde de `faks` yazmak) round-trip'ten geçer ama portalda alanı
 * siler. Bu yüzden "portal alan adlarını doğru yazar" testi gerçek fixture ile
 * AYRI bir test olarak korunuyor.
 */

import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'

import { toPortalUserInfo, toUserInfo } from './user.mapper.js'
import type { UserInfo } from './user.types.js'

const raw = portalResponses.userInfo.data as unknown as Record<string, unknown>

describe('toUserInfo', () => {
  // Kapsam: okuma yönü. Portal eksik alanı hiç göndermeyebiliyor; hepsi boş
  // stringe düşer, `undefined`'a değil — böylece çağıran her alanda güvenle
  // string bekleyebilir.
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
  // Kapsam: yazma yönü, İKİ ayrı testle: gidiş-dönüş bütünlüğü (sentetik,
  // her alanı benzersiz kayıtla) ve portal alan adlarının yazımı (gerçek
  // fixture ile). Ayrılmaları zorunlu — gerekçesi dosya başlığında.
  it('gidiş-dönüş TÜM alanları korur', () => {
    // Gerçek fixture ile gidiş-dönüş yapmak YETMEZ: fixture'da ad, soyad,
    // kasaba, faksNo ve webSitesiAdresi boş string ve boş değerde gidiş-dönüş
    // ayırt edici değil — bir alan eşlemeden düşse bile toUserInfo yine ''
    // üretir ve eşitlik bozulmaz. (Eski toMatchObject listesinin atladığı beş
    // alan tam olarak bunlardı.) Bu yüzden her alana benzersiz bir değer veren
    // sentetik bir kayıt kullanıyoruz; böylece düşen HER alan eşitliği bozar.
    const full: UserInfo = {
      taxOrIdentityNumber: 'v-vkn',
      title: 'v-unvan',
      firstName: 'v-ad',
      lastName: 'v-soyad',
      registryNumber: 'v-sicil',
      mersisNumber: 'v-mersis',
      taxOffice: 'v-vd',
      street: 'v-cadde',
      buildingName: 'v-apt',
      buildingNumber: 'v-aptno',
      doorNumber: 'v-kapi',
      town: 'v-kasaba',
      district: 'v-ilce',
      city: 'v-il',
      postalCode: 'v-posta',
      country: 'v-ulke',
      phone: 'v-tel',
      fax: 'v-faks',
      email: 'v-eposta',
      website: 'v-web',
      businessCenter: 'v-merkez',
    }
    expect(toUserInfo(toPortalUserInfo(full))).toEqual(full)
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
