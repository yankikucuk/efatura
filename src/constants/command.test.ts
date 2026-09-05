import { describe, expect, it } from 'vitest'

import { Command, PageName, SUCCESS_PATTERNS } from './index.js'

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
})
