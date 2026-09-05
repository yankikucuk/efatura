import { describe, expect, it } from 'vitest'

import { Command, FAILURE_MARKERS, PageName, SUCCESS_PATTERNS } from './index.js'

describe('komut kataloğu', () => {
  it('doğrulanmış komut adlarını içerir', () => {
    expect(Command.CREATE_INVOICE).toBe('EARSIV_PORTAL_FATURA_OLUSTUR')
    expect(Command.LIST_INVOICES).toBe('EARSIV_PORTAL_TASLAKLARI_GETIR')
    expect(Command.LIST_INCOMING).toBe('EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR')
    expect(Command.GET_INVOICE).toBe('EARSIV_PORTAL_FATURA_GETIR')
    expect(Command.DELETE_INVOICE).toBe('EARSIV_PORTAL_FATURA_SIL')
    expect(Command.SHOW_INVOICE).toBe('EARSIV_PORTAL_FATURA_GOSTER')
    expect(Command.DOWNLOAD_DOCUMENT).toBe('EARSIV_PORTAL_BELGE_INDIR')
    expect(Command.GET_USER_INFO).toBe('EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR')
    expect(Command.SAVE_USER_INFO).toBe('EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET')
    expect(Command.GET_COMPANY_INFO).toBe('SICIL_VEYA_MERNISTEN_BILGILERI_GETIR')
    expect(Command.QUERY_PHONE).toBe('EARSIV_PORTAL_TELEFONNO_SORGULA')
    expect(Command.SEND_SMS_CODE).toBe('EARSIV_PORTAL_SMSSIFRE_GONDER')
    expect(Command.VERIFY_SMS_CODE).toBe('0lhozfib5410mp')
    expect(Command.CREATE_CANCELLATION_REQUEST).toBe('EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR')
    expect(Command.CREATE_OBJECTION_REQUEST).toBe('EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR')
    expect(Command.LIST_DISPUTE_REQUESTS).toBe('EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR')
    expect(Command.RESPOND_TO_DISPUTE).toBe('EARSIV_PORTAL_IPTAL_ITIRAZ_TALEP_DURUM_GUNCELLE')
    expect(Command.GET_USER_MENU).toBe('getUserMenu')
    expect(Command.LOGIN).toBe('assos-login')
    expect(Command.SUGGEST_TEST_USER).toBe('kullaniciOner')
  })

  it('sayfa adları portal ekranlarıdır', () => {
    expect(PageName.INVOICE_FORM).toBe('RG_BASITFATURA')
    expect(PageName.INTERACTIVE_DRAFTS).toBe('RG_BASITTASLAKLAR')
    expect(PageName.DRAFTS).toBe('RG_TASLAKLAR')
    expect(PageName.INCOMING_DRAFTS).toBe('RG_ALICI_TASLAKLAR')
    expect(PageName.DISPUTE_DRAFTS).toBe('RG_IPTALITIRAZTASLAKLAR')
    expect(PageName.USER).toBe('RG_KULLANICI')
    expect(PageName.SMS_APPROVAL).toBe('RG_SMSONAY')
    expect(PageName.MAIN_MENU).toBe('MAINTREEMENU')
  })

  it('fatura oluşturma için başarı metni tanımlıdır', () => {
    const patterns = SUCCESS_PATTERNS[Command.CREATE_INVOICE]
    expect(patterns).toBeDefined()
    expect(
      'Faturanız başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden faturanıza ulaşabilirsiniz.',
    ).toContain(patterns?.[0] ?? '@@yok@@')
  })

  it('fatura silme başarı metni adet önekini tolere eder', () => {
    const patterns = SUCCESS_PATTERNS[Command.DELETE_INVOICE]
    expect('1 fatura başarıyla silindi.').toContain(patterns?.[0] ?? '@@yok@@')
  })

  it('başarı metni bilinmeyen komutlar için genel kalıp TANIMLI DEĞİLDİR', () => {
    // Genel "başarıyla" kalıbı bilinçli olarak kaldırıldı; bu komutlarda
    // hata tespiti FAILURE_MARKERS üzerinden yapılır.
    for (const command of [
      Command.SAVE_USER_INFO,
      Command.CREATE_CANCELLATION_REQUEST,
      Command.CREATE_OBJECTION_REQUEST,
      Command.RESPOND_TO_DISPUTE,
    ]) {
      expect(SUCCESS_PATTERNS[command]).toBeUndefined()
    }
  })
})

describe('FAILURE_MARKERS', () => {
  const isFailure = (text: string): boolean => FAILURE_MARKERS.some((marker) => marker.test(text))

  it('canlı portaldan yakalanan gerçek hata metinlerini yakalar', () => {
    expect(isFailure('Bu belge iptal talebi oluşturmak için gerekli koşulları sağlamıyor!')).toBe(
      true,
    )
    expect(isFailure('Talep cevabı kaydedilirken beklenmeyen bir hata ile karşılaşıldı.')).toBe(
      true,
    )
    expect(isFailure('Ettn ya eksik ya boş ya da 36 uzunluk sınırına uymuyor.')).toBe(true)
    expect(isFailure('Form parametrelerinde sorun var')).toBe(true)
    expect(isFailure('Bu işlem için yetkiniz yok')).toBe(true)
    expect(isFailure('Düzenlenmek üzere fatura getirilemedi. Hata kodu: 2-1109')).toBe(true)
  })

  it('"başarıyla" kelimesi geçen olumsuz cümleyi hata sayar', () => {
    // Genel "başarıyla" kalıbının tam olarak kaçırdığı vaka.
    expect(isFailure('İşleminiz başarıyla tamamlanamamıştır.')).toBe(true)
    expect(isFailure('Talebiniz başarıyla kaydedilemedi.')).toBe(true)
  })

  it('olumsuzluk eki taşımayan hata bildirimlerini de yakalar', () => {
    expect(isFailure('İşleminiz başarısız oldu.')).toBe(true)
    expect(isFailure('İtirazınız reddedildi.')).toBe(true)
    expect(isFailure('Talebiniz reddedilmiştir.')).toBe(true)
    expect(isFailure('Talebiniz olumsuz sonuçlandı.')).toBe(true)
  })

  it('masum kelimeleri hata saymaz', () => {
    // "muhatap" faturacılıkta standart bir terim ve "hata" alt metnini içerir.
    expect(isFailure('Muhatap firma bilgileri güncellendi.')).toBe(false)
    expect(isFailure('Ödemeniz başarıyla alınmıştır.')).toBe(false)
    // "Ramazan" içinde "amaz" geçer; olumsuzluk deseni sabitlenmemiş olsaydı
    // bu masum cümle hata sayılırdı.
    expect(
      isFailure(
        'Ramazan ayı nedeniyle çalışma saatleri değişmiştir; talebiniz başarıyla oluşturuldu.',
      ),
    ).toBe(false)
  })

  it('gerçek başarı metinlerini hata saymaz', () => {
    expect(
      isFailure(
        'Faturanız başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden faturanıza ulaşabilirsiniz.',
      ),
    ).toBe(false)
    expect(isFailure('1 fatura başarıyla silindi.')).toBe(false)
    expect(isFailure('Bilgileriniz başarıyla kaydedilmiştir.')).toBe(false)
    expect(isFailure('Talebiniz başarıyla oluşturuldu.')).toBe(false)
  })
})
