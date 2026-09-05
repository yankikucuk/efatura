import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../tests/fixtures/portal-responses.js'
import { Command } from '../constants/index.js'
import { EArsivApiError } from '../core/index.js'

import { parsePortalResponse } from './response.parser.js'

const ctx = { command: Command.CREATE_INVOICE, callId: 'test-call-id' }

/**
 * `EARSIV_PORTAL_FATURA_GOSTER` yanıtına benzeyen, gerçekçi boyutlu bir HTML
 * belge gövdesi üretir: gövde tek başına bir string değil, not hücresi,
 * kalem tablosu ve alıcı ünvanı içeren tam bir belge. Portaldan gelen gerçek
 * yanıt 47-55 KB civarındadır; dolgu metniyle bu aralığa yaklaştırılır.
 */
function buildInvoiceHtml(noteText: string): string {
  const filler = '<tr><td>Kalem</td><td>1 Adet</td><td>100,00 TRY</td></tr>\n'.repeat(700)
  return [
    '<!DOCTYPE html>',
    '<html><head><title>e-Arşiv Fatura</title></head><body>',
    '<div class="fatura-basligi">GIB2026000000917</div>',
    '<table class="kalemler">',
    filler,
    '</table>',
    '<div class="alici">NODE PROBE A1B2C3</div>',
    `<div class="fatura-notu">${noteText}</div>`,
    '</body></html>',
  ].join('\n')
}

describe('parsePortalResponse — payload.error yanlış-pozitifleri (I6)', () => {
  // `payload.error !== undefined && payload.error !== null` "", "0", 0 ve
  // false değerlerini de hata sayıyordu — `data.hata === ''` kusurunun (13
  // satır altında düzeltilen) aynısı, üst seviyede. Portal başarıda bu tür
  // "boş/sıfır" bayraklar gönderiyor.
  it.each([['', '0', 0, false] as const].flat())(
    'error alanı %j iken başarıyla ayrıştırır',
    (errorValue) => {
      const result = parsePortalResponse({ error: errorValue, data: { ok: true } }, ctx)
      expect(result).toEqual({ ok: true })
    },
  )
})

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

describe('parsePortalResponse — belge gövdesi yanlış-pozitifleri (Layer 1: DOCUMENT_COMMANDS)', () => {
  // Portal SHOW_INVOICE için render edilmiş HTML döndürür; bu HTML kullanıcı
  // metni taşır (fatura notu, alıcı ünvanı, kalem açıklaması) ve bu metin
  // FAILURE_MARKERS ile aynı işaretleri taşıyabilir. Bu blok, belge
  // gövdesinin bir durum mesajıymış gibi taranmadığını doğrular — HTML'in
  // KENDİSİ döndürülmelidir, hata fırlatılmamalıdır.
  it.each([
    ['Malzeme teslim edilemedi, iade alınmıştır.', 'olumsuzluk eki (edilemedi)'],
    ['Bu ürün için özel bir indirim uygulanmıştır, hata payı yoktur.', "'hata' alt metni"],
    ['Adres bilgisi geçersiz kılınana kadar geçerlidir.', "'geçersiz' alt metni"],
    ['Denenen üçüncü teslimat da başarısız denemelerin sonuncusuydu.', "'başarısız' alt metni"],
  ])('fatura notunda %s geçse bile HTML aynen döner (%s)', (noteText) => {
    const html = buildInvoiceHtml(noteText)
    const result = parsePortalResponse(
      { data: html },
      { command: Command.SHOW_INVOICE, callId: 'x' },
    )
    expect(result).toBe(html)
  })
})

describe('parsePortalResponse — Layer 2: kayıtsız komutlarda savunma sezgisi', () => {
  // DOCUMENT_COMMANDS'a kaydedilmeyi UNUTAN gelecekteki bir komut senaryosu:
  // DOWNLOAD_DOCUMENT şu an tabloda değil. Yine de metin HTML gövdesi gibi
  // görünüyorsa (`<` ile başlıyor) tarama atlanır ve gövde aynen döner.
  it('kayıtsız bir komutta uzun HTML gövdesi belge sayılır, hata işaretleri yok sayılır', () => {
    const html = buildInvoiceHtml('İşlem hata ile sonuçlanıp reddedilmiştir.')
    const result = parsePortalResponse(
      { data: html },
      { command: Command.DOWNLOAD_DOCUMENT, callId: 'x' },
    )
    expect(result).toBe(html)
  })

  it('kayıtsız bir komutta `<` ile başlamayan ama eşik üstü uzun metin de belge sayılır', () => {
    // Yalnızca uzunluk sezgisini, "<" ile başlama sezgisinden bağımsız
    // sınamak için HTML etiketi taşımayan (düz metin) ama eşiği aşan bir
    // gövde kullanılır. Bu test eşik kontrolü kaldırılırsa kırılır.
    const longPlainText = `Fatura açıklaması: ${'dolgu metni '.repeat(60)}sonunda hata oluştu.`
    expect(longPlainText.trimStart().startsWith('<')).toBe(false)
    expect(longPlainText.length).toBeGreaterThan(500)
    const result = parsePortalResponse(
      { data: longPlainText },
      { command: Command.DOWNLOAD_DOCUMENT, callId: 'x' },
    )
    expect(result).toBe(longPlainText)
  })

  it('kayıtsız bir komutta KISA gerçek hata metni hâlâ hata fırlatır', () => {
    // Layer 2 yalnızca belge gövdesi GİBİ görünen metinleri korur; kısa,
    // gerçek bir durum mesajı hâlâ FAILURE_MARKERS ile yakalanmalı.
    const shortError = 'Bilgileriniz kaydedilemedi.'
    expect(shortError.length).toBeLessThan(500)
    expect(() =>
      parsePortalResponse(
        { data: shortError },
        { command: Command.DOWNLOAD_DOCUMENT, callId: 'x' },
      ),
    ).toThrow(EArsivApiError)
  })
})

describe('parsePortalResponse — regresyon: gerçek portal hata metinleri hâlâ hata sayılır', () => {
  // Bu paket, belge muafiyetinin (Layer 1/2) heuristiği GEVŞETTİĞİ tek yer
  // olduğu için en kritik regresyondur: aşağıdaki metinlerin HİÇBİRİ ne `<`
  // ile başlar ne de eşik üstü uzundur, bu yüzden Layer 2'ye takılmadan
  // FAILURE_MARKERS'a düşmeliler. Komut kasıtlı olarak SUCCESS_PATTERNS'ta
  // OLMAYAN ve DOCUMENT_COMMANDS'ta OLMAYAN bir komut (RESPOND_TO_DISPUTE):
  // bu test yalnızca "throw" davranışını değil, GERÇEK sınıra en yakın
  // (166 karakterlik disputePrecondition gibi) mesajların hâlâ eşiğin
  // ALTINDA kaldığını ve yine de yakalandığını doğrular.
  it.each([
    portalResponses.ettnRejected.data,
    portalResponses.disputePrecondition.data,
    'Talep cevabı kaydedilirken beklenmeyen bir hata ile karşılaşıldı.',
    'Form parametrelerinde sorun var',
    'Bu işlem için yetkiniz yok',
    'İşleminiz başarıyla tamamlanamamıştır.',
    'Talebiniz başarıyla kaydedilemedi.',
    'İşleminiz başarısız oldu.',
    'İtirazınız reddedildi.',
    'Talebiniz reddedilmiştir.',
    'Talebiniz olumsuz sonuçlandı.',
    'Bu mükellef e-Fatura kullanıcısı.',
    'e-Arşiv oturumu zaman aşımına uğradı.',
  ])('%s hâlâ EArsivApiError fırlatır', (errorText) => {
    expect(errorText.trimStart().startsWith('<')).toBe(false)
    expect(errorText.length).toBeLessThan(500)
    expect(() =>
      parsePortalResponse(
        { data: errorText },
        { command: Command.RESPOND_TO_DISPUTE, callId: 'x' },
      ),
    ).toThrow(EArsivApiError)
  })
})
