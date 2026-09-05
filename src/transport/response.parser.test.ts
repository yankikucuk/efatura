import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../tests/fixtures/portal-responses.js'
import { Command } from '../constants/index.js'
import { EArsivApiError } from '../core/index.js'

import { parsePortalResponse } from './response.parser.js'

const ctx = { command: Command.CREATE_INVOICE, callId: 'test-call-id' }

describe('parsePortalResponse', () => {
  it('üst seviye error biçimini hataya çevirir', () => {
    expect(() => parsePortalResponse(portalResponses.unauthorized, ctx)).toThrow(EArsivApiError)
    try {
      parsePortalResponse(portalResponses.unauthorized, ctx)
    } catch (error) {
      const api = error as EArsivApiError
      expect(api.message).toContain('Bu işlem için yetkiniz yok')
      expect(api.messages).toEqual(['Bu işlem için yetkiniz yok'])
      expect(api.raw).toBe(portalResponses.unauthorized)
      expect(api.command).toBe(Command.CREATE_INVOICE)
      expect(api.callId).toBe('test-call-id')
    }
  })

  it('messages dizisi düz string içerdiğinde de çalışır', () => {
    try {
      parsePortalResponse(portalResponses.systemError, ctx)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivApiError).message).toContain('NullPointerException')
    }
  })

  it('data.hata biçiminden hata kodunu ayrıştırır', () => {
    try {
      parsePortalResponse(portalResponses.businessError, ctx)
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      const api = error as EArsivApiError
      expect(api.message).toContain('Düzenlenmek üzere fatura getirilemedi')
      expect(api.code).toBe('2-1109')
    }
  })

  it('beklenen başarı metnini içermeyen string data hatadır', () => {
    expect(() => parsePortalResponse(portalResponses.ettnRejected, ctx)).toThrow(EArsivApiError)
  })

  it('beklenen başarı metnini içeren string data geçer', () => {
    const result = parsePortalResponse(portalResponses.invoiceCreated, ctx)
    expect(result).toContain('başarıyla oluşturulmuştur')
  })

  it('başarı kalıbı tanımsız komutlarda temiz string data aynen döner', () => {
    const html = { data: '<html>fatura</html>' }
    expect(parsePortalResponse(html, { command: Command.SHOW_INVOICE, callId: 'x' })).toBe(
      '<html>fatura</html>',
    )
  })

  it('başarı kalıbı tanımsız komutlarda hata işareti taşıyan string hatadır', () => {
    expect(() =>
      parsePortalResponse(
        { data: 'Bilgileriniz kaydedilemedi.' },
        { command: Command.SAVE_USER_INFO, callId: 'x' },
      ),
    ).toThrow(EArsivApiError)
  })

  it('"başarıyla" geçen olumsuz cümle başarı sayılmaz', () => {
    // Genel "başarıyla" kalıbının kaçırdığı vaka; FAILURE_MARKERS yakalar.
    expect(() =>
      parsePortalResponse(
        { data: 'İşleminiz başarıyla tamamlanamamıştır.' },
        { command: Command.RESPOND_TO_DISPUTE, callId: 'x' },
      ),
    ).toThrow(EArsivApiError)
  })

  it('gerçek başarı metni geçer', () => {
    expect(
      parsePortalResponse(
        { data: 'Talebiniz başarıyla oluşturuldu.' },
        { command: Command.CREATE_CANCELLATION_REQUEST, callId: 'x' },
      ),
    ).toBe('Talebiniz başarıyla oluşturuldu.')
  })

  it('dizi ve nesne data değerlerini aynen döndürür', () => {
    expect(
      parsePortalResponse(portalResponses.draftList, {
        command: Command.LIST_INVOICES,
        callId: 'x',
      }),
    ).toHaveLength(1)
    expect(
      parsePortalResponse(portalResponses.userInfo, {
        command: Command.GET_USER_INFO,
        callId: 'x',
      }),
    ).toMatchObject({ vknTckn: '3333333301' })
  })

  it('boş dizi geçerli bir sonuçtur', () => {
    expect(
      parsePortalResponse(portalResponses.emptyDisputeList, {
        command: Command.LIST_DISPUTE_REQUESTS,
        callId: 'x',
      }),
    ).toEqual([])
  })

  it('BOŞ data.hata alanı hata DEĞİLDİR', () => {
    // Canlı portalda yakalanan kusur: FATURA_GETIR başarıda da `hata` alanını
    // gönderiyor ama boş string olarak. Yalnızca typeof kontrolü yapmak her
    // başarılı getInvoice çağrısını boş mesajlı hataya çeviriyordu.
    const result = parsePortalResponse(portalResponses.invoiceDetailSuccess, {
      command: Command.GET_INVOICE,
      callId: 'x',
    })
    expect(result).toMatchObject({ faturaUuid: '3729b07c-f9a4-46f1-ac46-eb88f5ccea84' })
  })

  it('yalnızca boşluk içeren data.hata da hata değildir', () => {
    expect(
      parsePortalResponse(
        { data: { hata: '   ', belgeNumarasi: 'GIB1' } },
        { command: Command.GET_INVOICE, callId: 'x' },
      ),
    ).toMatchObject({ belgeNumarasi: 'GIB1' })
  })

  it('iptal talebi ön koşul metni hatadır', () => {
    expect(() =>
      parsePortalResponse(portalResponses.disputePrecondition, {
        command: Command.CREATE_CANCELLATION_REQUEST,
        callId: 'x',
      }),
    ).toThrow(EArsivApiError)
  })

  it('JSON olmayan yanıtta hata fırlatır', () => {
    expect(() => parsePortalResponse('düz metin', ctx)).toThrow(EArsivApiError)
    expect(() => parsePortalResponse(null, ctx)).toThrow(EArsivApiError)
  })
})
