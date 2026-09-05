import { describe, expect, it, vi } from 'vitest'

import { portalResponses } from '../../tests/fixtures/portal-responses.js'
import { EArsivAuthError, EArsivPortalDefectError } from '../core/index.js'

import { EArsivClient } from './earsiv.client.js'

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

describe('EArsivClient', () => {
  it('varsayılan olarak canlı ortamı seçer', () => {
    expect(new EArsivClient().environment).toBe('production')
  })

  it('test ortamı seçilebilir', () => {
    expect(new EArsivClient({ environment: 'test' }).environment).toBe('test')
  })

  it('oturum açmadan çağrı yapılırsa EArsivAuthError fırlatır', async () => {
    const client = new EArsivClient({ environment: 'test', fetch: vi.fn() as never })
    await expect(client.getUserInfo()).rejects.toThrow(EArsivAuthError)
  })

  it('test kullanıcısıyla giriş yapar ve token açığa çıkar', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/esign') ? json({ userid: '33333399' }) : json({ token: 'tok' }),
    )
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const result = await client.loginWithTestUser()

    expect(result.username).toBe('33333399')
    expect(client.token).toBe('tok')
    expect(client.isAuthenticated).toBe(true)
  })

  it('setToken ile önceden alınmış token kullanılabilir', async () => {
    const fetchMock = vi.fn(() => json({ data: { vknTckn: '1234567890' } }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    client.setToken('kayitli')
    await client.getUserInfo()

    const body = new URLSearchParams(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.get('token')).toBe('kayitli')
  })

  it('toPdf önce HTML çeker, sonra render eder', async () => {
    // Bu, toPdf'in davranışını sabitleyen tek test. Aşağıdaki yüzey testi
    // yalnızca metodun var olduğunu kontrol ediyor; toPdf boş bir gövdeye
    // indirgense bile yeşil kalırdı.
    const fetchMock = vi.fn(() => json({ data: '<html><body>fatura</body></html>' }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    client.setToken('tok')

    // puppeteer opsiyonel peerDependency ve bu repoda kurulu değil, yani
    // render adımı kurulum talimatıyla düşer — beklenen ve deterministik.
    await expect(client.toPdf('abc', { signed: true })).rejects.toThrow(/npm i puppeteer/)

    // Asıl iddia: düşmeden ÖNCE HTML çekilmiş olmalı. Sıra yanlış olsaydı
    // ya da toPdf sabit bir metin render etseydi bu assertion kırılırdı.
    const body = new URLSearchParams(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.get('cmd')).toBe('EARSIV_PORTAL_FATURA_GOSTER')
    expect(JSON.parse(body.get('jp') ?? '{}')).toEqual({
      ettn: 'abc',
      onayDurumu: 'Onaylandı',
    })
  })

  it.each([
    ['listDrafts', ['03/09/2026', '03/09/2026'], 'EARSIV_PORTAL_TASLAKLARI_GETIR'],
    ['listIncoming', ['03/09/2026', '03/09/2026'], 'EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR'],
    [
      'listIncomingExternal',
      ['03/09/2026', '03/09/2026'],
      'EARSIV_PORTAL_ENTEGRATOR_ADIMA_DUZENLENENLER_SORGULA',
    ],
    ['getInvoice', ['abc'], 'EARSIV_PORTAL_FATURA_GETIR'],
    ['getInvoiceHtml', ['abc'], 'EARSIV_PORTAL_FATURA_GOSTER'],
    ['listProducerReceipts', ['05/09/2026', '05/09/2026'], 'EARSIV_PORTAL_TASLAKLARI_GETIR'],
    ['getProducerReceipt', ['abc'], 'EARSIV_PORTAL_MUSTAHSIL_GETIR'],
    ['getProducerReceiptHtml', ['abc'], 'EARSIV_PORTAL_FATURA_GOSTER'],
    ['listSelfEmployedReceipts', ['05/09/2026', '05/09/2026'], 'EARSIV_PORTAL_TASLAKLARI_GETIR'],
    ['getSelfEmployedReceipt', ['abc'], 'EARSIV_PORTAL_SERBEST_MESLEK_GETIR'],
    ['getUserInfo', [], 'EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR'],
    ['getCompanyInfo', ['1234567890'], 'SICIL_VEYA_MERNISTEN_BILGILERI_GETIR'],
    ['getPhoneNumber', [], 'EARSIV_PORTAL_TELEFONNO_SORGULA'],
    [
      'listDisputeRequests',
      ['03/09/2026', '03/09/2026'],
      'EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR',
    ],
    [
      'createCancellationRequest',
      [{ ettn: 'a', reason: 'r' }],
      'EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR',
    ],
    [
      'respondToDisputeRequest',
      [{ disputeId: '1', answer: '1' }],
      'EARSIV_PORTAL_IPTAL_ITIRAZ_TALEP_DURUM_GUNCELLE',
    ],
    [
      'createObjectionRequestForIncoming',
      [
        {
          ettn: 'a',
          invoiceOid: '1',
          totalAmount: 10,
          sellerTaxOrIdentityNumber: '9999999999',
          documentNumber: 'GIB1',
          method: 'KEP',
          referenceDocumentId: '1',
          referenceDocumentDate: '03/09/2026',
          reason: 'r',
        },
      ],
      'EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR',
    ],
  ] as [string, unknown[], string][])(
    'facade %s metodunu %s komutuna yönlendirir',
    async (method, args, expectedCommand) => {
      // Facade metodları tek satırlık delegasyon; yanlış bağlanmış bir tanesi
      // (ör. listIncoming'in listDrafts'a gitmesi) yüzey testine takılmazdı.
      // Gönderilen portal komutunu sabitlemek her yönlendirmeyi pinler.
      const fetchMock = vi.fn(() => json({ data: [] }))
      const client = new EArsivClient({
        environment: 'test',
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      })
      client.setToken('tok')

      await (client as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[method]!(
        ...args,
      )

      const body = new URLSearchParams(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
      )
      expect(body.get('cmd')).toBe(expectedCommand)
    },
  )

  it('createObjectionRequestForIncoming, createObjectionRequest ile AYNI komut ama FARKLI pageName gönderir', async () => {
    // it.each yüzey testi yalnızca `cmd` alanını doğruluyor; ikisi de AYNI
    // komutu (EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR) gönderdiği için o test
    // yanlış pageName'i asla yakalamazdı — asıl regresyon burada.
    const fetchMock = vi.fn(() => json({ data: 'başarıyla' }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    client.setToken('tok')

    await client.createObjectionRequestForIncoming({
      ettn: 'abc',
      invoiceOid: '999',
      totalAmount: 120,
      sellerTaxOrIdentityNumber: '9999999999',
      documentNumber: 'GIB123',
      method: 'KEP',
      referenceDocumentId: '2026/42',
      referenceDocumentDate: '03/09/2026',
      reason: 'Hizmet alınmadı',
    })

    const body = new URLSearchParams(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.get('pageName')).toBe('RG_ALICI_TASLAKLAR')
    expect(JSON.parse(body.get('jp') ?? '{}')).toEqual({
      ettn: 'abc',
      faturaOid: '999',
      toplamTutar: '120.00',
      saticiVknTckn: '9999999999',
      belgeNumarasi: 'GIB123',
      onayDurumu: 'Onaylandı',
      belgeTuru: 'FATURA',
      itirazYontemi: 'KEP',
      referansBelgeId: '2026/42',
      referansBelgeTarihi: '03/09/2026',
      talepAciklama: 'Hizmet alınmadı',
    })
  })

  it('makbuz listeleme facade metotları ÜST KÜME listesini kendi belge türüne süzer', async () => {
    // it.each yüzey testi ikisinde de AYNI komutu (TASLAKLARI_GETIR) görür,
    // yani iki listeyi birbirine bağlamış bir yönlendirme hatasını asla
    // yakalayamaz. Asıl ayrım süzme sonucunda.
    const fetchMock = vi.fn(() => json(portalResponses.receiptDraftList))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    client.setToken('tok')

    const producers = await client.listProducerReceipts('05/09/2026', '05/09/2026')
    const selfEmployed = await client.listSelfEmployedReceipts('05/09/2026', '05/09/2026')

    expect(producers.map((row) => row.documentType)).toEqual([
      'MÜSTAHSİL MAKBUZU',
      'MÜSTAHSİL MAKBUZU',
    ])
    expect(selfEmployed.map((row) => row.documentType)).toEqual(['SERBEST MESLEK MAKBUZU'])
  })

  it('SMM HTML/PDF metotları AĞA ÇIKMADAN portal kusuru hatası verir', () => {
    const fetchMock = vi.fn(() => json({ data: 'olmamalı' }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    client.setToken('tok')

    expect(() => client.getSelfEmployedReceiptHtml('abc')).toThrow(EArsivPortalDefectError)
    expect(() => client.selfEmployedReceiptToPdf('abc')).toThrow(EArsivPortalDefectError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('müstahsil HTML gösterimi ÇALIŞIR ve fatura ile aynı komuta gider', async () => {
    // Kısıt SMM'ye özgü; müstahsili de kapatmak gereksiz bir yetenek kaybı
    // olurdu (canlı doğrulandı: 51 KB HTML dönüyor).
    const fetchMock = vi.fn(() => json({ data: '<html>makbuz</html>' }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    client.setToken('tok')

    expect(await client.getProducerReceiptHtml('abc')).toBe('<html>makbuz</html>')
  })

  it('public API yüzeyi eksiksiz', () => {
    // Not: bu test yalnızca yüzeyi koruyor — bir metodun kazara silinmesini
    // yakalar, davranışını değil. Davranış testleri yukarıdaki beş testte.
    const client = new EArsivClient()
    for (const method of [
      'login',
      'loginWithTestUser',
      'logout',
      'setToken',
      'createDraft',
      'listDrafts',
      'listIncoming',
      'listIncomingExternal',
      'getInvoice',
      'cancelDraft',
      'getInvoiceHtml',
      'downloadPackage',
      'getDownloadUrl',
      'toPdf',
      'getUserInfo',
      'updateUserInfo',
      'getCompanyInfo',
      'sendSmsCode',
      'verifySmsCode',
      'getPhoneNumber',
      'createCancellationRequest',
      'createObjectionRequest',
      'createObjectionRequestForIncoming',
      'listDisputeRequests',
      'respondToDisputeRequest',
      'createProducerReceipt',
      'listProducerReceipts',
      'getProducerReceipt',
      'getProducerReceiptHtml',
      'producerReceiptToPdf',
      'createSelfEmployedReceipt',
      'listSelfEmployedReceipts',
      'getSelfEmployedReceipt',
      'getSelfEmployedReceiptHtml',
      'selfEmployedReceiptToPdf',
    ]) {
      expect(typeof (client as unknown as Record<string, unknown>)[method]).toBe('function')
    }
  })
})
