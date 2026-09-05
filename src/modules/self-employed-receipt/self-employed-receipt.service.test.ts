/**
 * Serbest meslek makbuzu servisi — oluşturma, listeleme, okuma ve
 * DESTEKLENMEYEN gösterim yolu.
 *
 * Müstahsille ortak davranışların (üst küme listesinden süzme, üç istekli ETTN
 * çözümü, eşzamanlı çağrıların serileştirilmesi) yanında SMM'ye ÖZGÜ iki şey
 * burada sabitlenir:
 *
 * 1. ETTN daraltma ipucu `unvan`dan DEĞİL, ad + soyaddan üretilir. Canlı
 *    doğrulandı: liste satırındaki `aliciUnvanAdSoyad`, `adi` ve `soyadi`
 *    alanlarının birleşimidir ve yalnızca `unvan` gönderilen çalıştırmada BOŞ
 *    döndü. İpucu ünvandan üretilseydi daraltma sessizce bozulurdu; test bu
 *    yüzden makbuza asla yansımaması gereken bir ünvan ("HİÇ KULLANILMAMALI
 *    A.Ş.") veriyor.
 * 2. `getHtml`/`toPdf` AÇILMADI. Portal `FATURA_GOSTER` komutunu geçerli bir
 *    SMM ETTN'i ile ham bir Java istisnasıyla ("String index out of range: 4")
 *    reddediyor; denenen tüm varyantlar (iki `pageName`, ek `belgeTuru`, liste
 *    ve detay ETTN'i, `belgeNumarasi`, alternatif komut adları) başarısız oldu.
 *    Müstahsil AYNI komutla çalışıyor, yani kusur SMM'ye özgü ve bizim
 *    tarafımızda çözülemez. Metotlar yine de SİLİNMEDİ: silinseydi kullanıcı
 *    `getInvoiceHtml`'i bir SMM ETTN'iyle dener ve portalın ham istisnasını
 *    kendi hatası sanardı.
 *
 * Hata metninin İÇERİĞİ ayrıca test edilir; yalnızca "fırlatıyor mu" demek,
 * mesaj "Geçersiz kullanım" gibi yanıltıcı bir şeye dönse bile yeşil kalırdı.
 */

import { describe, expect, it, vi } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import { EArsivAmbiguousResultError, EArsivPortalDefectError } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { SelfEmployedReceiptService } from './self-employed-receipt.service.js'
import type { SelfEmployedReceiptInput } from './self-employed-receipt.types.js'

const CREATED = portalResponses.selfEmployedReceiptCreated.data

const receiptRow = (ettn: string, name = 'PROBE SERBEST'): Record<string, unknown> => ({
  belgeNumarasi: `GIB-${ettn}`,
  aliciVknTckn: '11111111111',
  aliciUnvanAdSoyad: name,
  belgeTarihi: '05-09-2026',
  belgeTuru: 'SERBEST MESLEK MAKBUZU',
  onayDurumu: 'Onaylanmadı',
  ettn,
})

const input: SelfEmployedReceiptInput = {
  date: '05/09/2026',
  payer: { taxOrIdentityNumber: '11111111111', firstName: 'PROBE', lastName: 'SERBEST' },
  lineItems: [{ description: 'Danışmanlık', grossFee: 1000, vatRate: 20, withholdingRate: 20 }],
}

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('SelfEmployedReceiptService.createReceipt', () => {
  // Kapsam: üç istekli ETTN çözümü, ipucunun ad+soyaddan üretilmesi, ÜST KÜME
  // listesinden SMM satırlarına süzme, doğrulama kapısı, belirsizlikte
  // reddetme ve eşzamanlı çağrıların serileştirilmesi.
  it('anlık görüntü farkıyla ETTN çözer', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([receiptRow('eski')])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('eski'), receiptRow('yeni')])

    const result = await new SelfEmployedReceiptService(gatewayMock(call)).createReceipt(input)

    expect(result).toEqual({
      ettn: 'yeni',
      documentNumber: 'GIB-yeni',
      date: '05/09/2026',
      approvalStatus: 'Onaylanmadı',
    })
  })

  it('doğru komut ve sayfa adıyla gönderir', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('yeni')])

    await new SelfEmployedReceiptService(gatewayMock(call)).createReceipt(input)

    expect(call.mock.calls[1]?.[0]).toBe('EARSIV_PORTAL_SERBEST_MESLEK_MAKBUZU_OLUSTUR')
    expect(call.mock.calls[1]?.[1]).toBe('RG_SERBEST')
    expect(call.mock.calls[1]?.[2]).not.toHaveProperty('ettn')
  })

  it('ETTN ipucunda `unvan` DEĞİL ad+soyad kullanılır', async () => {
    // Canlı doğrulandı: SMM özet satırındaki `aliciUnvanAdSoyad`, `adi` ve
    // `soyadi` alanlarının birleşimidir; yalnızca `unvan` verildiğinde bu
    // alan BOŞ dönüyor. İpucu ünvandan üretilseydi burada eşleşme
    // sağlanamaz ve daraltma başarısız olurdu.
    const mine = receiptRow('benim', 'PROBE SERBEST')
    const other = { ...receiptRow('baska', 'BASKA KISI'), aliciVknTckn: '2222222222' }
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([other, mine])

    const result = await new SelfEmployedReceiptService(gatewayMock(call)).createReceipt({
      ...input,
      payer: { ...input.payer, title: 'HİÇ KULLANILMAMALI A.Ş.' },
    })
    expect(result.ettn).toBe('benim')
  })

  it('anlık görüntüyü ÜST KÜME listesinden alıp SMM satırlarına süzer', async () => {
    const producerRow: Record<string, unknown> = {
      ...receiptRow('mustahsil-yeni'),
      belgeTuru: 'MÜSTAHSİL MAKBUZU',
    }
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([producerRow, receiptRow('smm-yeni')])

    const result = await new SelfEmployedReceiptService(gatewayMock(call)).createReceipt(input)

    expect(call.mock.calls[0]?.[2]).toEqual({
      baslangic: '05/09/2026',
      bitis: '05/09/2026',
      hangiTip: 'Buyuk',
    })
    expect(result.ettn).toBe('smm-yeni')
  })

  it('geçersiz girdide ağa hiç çıkmaz', async () => {
    const call = vi.fn()
    await expect(
      new SelfEmployedReceiptService(gatewayMock(call)).createReceipt({ ...input, lineItems: [] }),
    ).rejects.toThrow(/doğrulama/)
    expect(call).not.toHaveBeenCalled()
  })

  it('belirsizlikte hata fırlatır', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('a'), receiptRow('b')])

    await expect(
      new SelfEmployedReceiptService(gatewayMock(call)).createReceipt(input),
    ).rejects.toThrow(EArsivAmbiguousResultError)
  })

  it('aynı örnek üzerinden EŞZAMANLI iki çağrı ayrı ETTN ile döner', async () => {
    const drafts: Record<string, unknown>[] = []
    let seq = 0
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
    const call = vi.fn(async (command: string) => {
      await tick()
      if (command === 'EARSIV_PORTAL_TASLAKLARI_GETIR') return drafts.map((row) => ({ ...row }))
      if (command === 'EARSIV_PORTAL_SERBEST_MESLEK_MAKBUZU_OLUSTUR') {
        seq += 1
        drafts.push(receiptRow(`ettn-${String(seq)}`))
        return CREATED
      }
      throw new Error(`beklenmeyen komut: ${command}`)
    })

    const service = new SelfEmployedReceiptService(gatewayMock(call))
    const [first, second] = await Promise.all([
      service.createReceipt(input),
      service.createReceipt(input),
    ])

    expect(new Set([first.ettn, second.ettn])).toEqual(new Set(['ettn-1', 'ettn-2']))
  })
})

describe('SelfEmployedReceiptService.listReceipts', () => {
  // Kapsam: aynı üst küme listesinden yalnızca SMM satırlarının süzülmesi.
  // Fikstür canlı portaldan yakalanmıştır (iki müstahsil + bir SMM).
  it('yalnızca serbest meslek makbuzlarını döndürür', async () => {
    const call = vi.fn().mockResolvedValue(portalResponses.receiptDraftList.data)
    const rows = await new SelfEmployedReceiptService(gatewayMock(call)).listReceipts(
      '05/09/2026',
      '05/09/2026',
    )

    // Gerçek portal yanıtı iki müstahsil + bir SMM satırı içeriyor.
    expect(rows).toHaveLength(1)
    expect(rows[0]?.documentType).toBe('SERBEST MESLEK MAKBUZU')
    expect(rows[0]?.ettn).toBe('7ae53b5f-d5a5-489b-9ba1-fe5801a8a209')
    expect(rows[0]?.buyerName).toBe('PROBE SERBEST')
  })

  it('dizi olmayan yanıtta boş liste döner', async () => {
    const call = vi.fn().mockResolvedValue(null)
    expect(
      await new SelfEmployedReceiptService(gatewayMock(call)).listReceipts(
        '05/09/2026',
        '05/09/2026',
      ),
    ).toEqual([])
  })
})

describe('SelfEmployedReceiptService.getReceipt', () => {
  // Kapsam: SMM'nin KENDİ komut ve sayfa adıyla okunması ve belge
  // toplamlarının geri okunması.
  it('kendi komut ve sayfa adıyla detay çeker', async () => {
    const call = vi.fn().mockResolvedValue(portalResponses.selfEmployedReceiptDetail.data)
    const detail = await new SelfEmployedReceiptService(gatewayMock(call)).getReceipt(
      '7ae53b5f-d5a5-489b-9ba1-fe5801a8a209',
    )

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_SERBEST_MESLEK_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_SERBEST')
    expect(call.mock.calls[0]?.[2]).toEqual({ ettn: '7ae53b5f-d5a5-489b-9ba1-fe5801a8a209' })
    expect(detail.totals.netReceived).toBe(900)
  })
})

describe('SelfEmployedReceiptService.getHtml — portal kusuru', () => {
  // Kapsam: DESTEKLENMEYEN gösterim yolunun sözleşmesi — AĞA ÇIKMADAN
  // fırlatma ve hata metninin İÇERİĞİ (kusurun portalda olduğu, portalın
  // kendi metni, müstahsilin aynı komutla çalıştığı, çalışan alternatif ve
  // istenen ETTN).
  const service = (): { service: SelfEmployedReceiptService; call: ReturnType<typeof vi.fn> } => {
    const call = vi.fn()
    return { service: new SelfEmployedReceiptService(gatewayMock(call)), call }
  }

  it('AĞA HİÇ ÇIKMADAN EArsivPortalDefectError fırlatır', () => {
    const { service: svc, call } = service()
    expect(() => svc.getHtml('7ae53b5f-d5a5-489b-9ba1-fe5801a8a209')).toThrow(
      EArsivPortalDefectError,
    )
    // İstek atılsaydı kullanıcı ham Java istisnasını görürdü; bu yüzden
    // portal komutuna hiç gidilmiyor.
    expect(call).not.toHaveBeenCalled()
  })

  it('hata kullanıcıyı suçlamaz: kusurun PORTALDA olduğunu ve neden bizde çözülemediğini söyler', () => {
    // Bu test hata metninin İÇERİĞİNİ pinler. Yalnızca "fırlatıyor mu"
    // demek, mesaj "Geçersiz kullanım" gibi yanıltıcı bir şeye dönse bile
    // yeşil kalırdı.
    let thrown: EArsivPortalDefectError | undefined
    try {
      service().service.getHtml('abc-123')
    } catch (error) {
      thrown = error as EArsivPortalDefectError
    }

    expect(thrown).toBeInstanceOf(EArsivPortalDefectError)
    expect(thrown?.kind).toBe('portal-defect')
    expect(thrown?.message).toContain('portal')
    // Portalın kendi hata metni ve komutu kanıt olarak taşınır.
    expect(thrown?.portalMessage).toBe('String index out of range: 4')
    expect(thrown?.command).toBe('EARSIV_PORTAL_FATURA_GOSTER')
    // Müstahsilin AYNI komutla çalıştığı bilgisi, kusurun bize ait
    // olmadığının kanıtıdır.
    expect(thrown?.message).toMatch(/[Mm]üstahsil/)
    // Kullanıcıya çalışan bir alternatif gösterilir.
    expect(thrown?.message).toContain('getSelfEmployedReceipt')
    // İstenen ETTN mesajda yer alır ki günlükte hangi belge olduğu bilinsin.
    expect(thrown?.message).toContain('abc-123')
  })

  it('kısıt anlatısı BASILABİLİR RESMİ PDF yolunu gösterir', () => {
    // Kısıt 2026-09-05'te ÖNEMLİ ÖLÇÜDE yumuşadı: portalın HTML gösterimi
    // hâlâ bozuk, AMA indirme uç noktası `belgeTip='SERBEST MESLEK MAKBUZU'`
    // ile doğrudan resmî bir PDF döndürüyor (`%PDF-1.5`, dosya adı `_s.pdf`;
    // canlı doğrulandı). Eski mesaj kullanıcıya yalnızca `getSelfEmployedReceipt`
    // ile VERİYE erişebileceğini söylüyordu — yani basılabilir belgeye hiç
    // ulaşamayacağını ima ediyordu, ki bu artık YANLIŞ. Elinde bir çıktı
    // gerekli olan kullanıcı, var olan yolu bilmeden PDF'i kendi üretmeye
    // ya da özelliği hiç kullanmamaya yönelirdi.
    let thrown: EArsivPortalDefectError | undefined
    try {
      service().service.getHtml('abc-123')
    } catch (error) {
      thrown = error as EArsivPortalDefectError
    }

    // Çalışan yolun ADI mesajda geçmeli; "bir yolu var" demek yetmez.
    expect(thrown?.message).toContain('downloadSelfEmployedReceiptPdf')
    // Ve dönen şeyin PDF olduğu söylenmeli — kullanıcı ZIP beklemesin.
    expect(thrown?.message).toMatch(/PDF/)
    // Veri yolu da korunur; ikisi farklı ihtiyaçlara cevap verir.
    expect(thrown?.message).toContain('getSelfEmployedReceipt(')
  })

  it('toPdf da aynı hatayı verir', () => {
    expect(() => service().service.toPdf('abc-123')).toThrow(EArsivPortalDefectError)
  })
})
