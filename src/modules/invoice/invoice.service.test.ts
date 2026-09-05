import { describe, expect, it, vi } from 'vitest'

import { InvoiceListKind, Unit } from '../../constants/index.js'
import { EArsivAmbiguousResultError } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { InvoiceService } from './invoice.service.js'
import type { InvoiceInput } from './invoice.types.js'

const draftRow = (ettn: string, name = 'Ali Yılmaz'): Record<string, unknown> => ({
  belgeNumarasi: `GIB-${ettn}`,
  aliciVknTckn: '11111111111',
  aliciUnvanAdSoyad: name,
  belgeTarihi: '03-09-2026',
  belgeTuru: 'FATURA',
  onayDurumu: 'Onaylanmadı',
  ettn,
})

const input: InvoiceInput = {
  date: '03/09/2026',
  buyer: { taxOrIdentityNumber: '11111111111', firstName: 'Ali', lastName: 'Yılmaz' },
  lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 }],
}

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('InvoiceService.createDraft', () => {
  it('anlık görüntü farkıyla ETTN çözer', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([draftRow('eski')])
      .mockResolvedValueOnce('Faturanız başarıyla oluşturulmuştur.')
      .mockResolvedValueOnce([draftRow('eski'), draftRow('yeni')])

    const result = await new InvoiceService(gatewayMock(call)).createDraft(input)

    expect(result).toEqual({
      ettn: 'yeni',
      documentNumber: 'GIB-yeni',
      date: '03/09/2026',
      approvalStatus: 'Onaylanmadı',
    })
    expect(call).toHaveBeenCalledTimes(3)
  })

  it('oluşturma yükünde faturaUuid göndermez', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce('Faturanız başarıyla oluşturulmuştur.')
      .mockResolvedValueOnce([draftRow('yeni')])

    await new InvoiceService(gatewayMock(call)).createDraft(input)

    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(payload).not.toHaveProperty('faturaUuid')
    expect(payload.vknTckn).toBe('11111111111')
  })

  it('geçersiz girdide ağa hiç çıkmaz', async () => {
    const call = vi.fn()
    await expect(
      new InvoiceService(gatewayMock(call)).createDraft({ ...input, lineItems: [] }),
    ).rejects.toThrow(/doğrulama/)
    expect(call).not.toHaveBeenCalled()
  })

  it('belirsizlikte hata fırlatır', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce('Faturanız başarıyla oluşturulmuştur.')
      .mockResolvedValueOnce([draftRow('a'), draftRow('b')])

    await expect(new InvoiceService(gatewayMock(call)).createDraft(input)).rejects.toThrow(
      EArsivAmbiguousResultError,
    )
  })
})

describe('InvoiceService.listDrafts', () => {
  it('varsayılan olarak interaktif listeyi sorgular', async () => {
    const call = vi.fn().mockResolvedValue([draftRow('a')])
    const result = await new InvoiceService(gatewayMock(call)).listDrafts(
      '01/09/2026',
      '03/09/2026',
    )

    expect(result[0]?.ettn).toBe('a')
    expect(result[0]?.date).toBe('03/09/2026')
    expect(call.mock.calls[0]?.[1]).toBe('RG_BASITTASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      baslangic: '01/09/2026',
      bitis: '03/09/2026',
      hangiTip: '5000/30000',
    })
  })

  it('standart liste için sayfa adını ve hangiTip değerini değiştirir', async () => {
    const call = vi.fn().mockResolvedValue([])
    await new InvoiceService(gatewayMock(call)).listDrafts('01/09/2026', '03/09/2026', {
      kind: InvoiceListKind.STANDARD,
    })

    expect(call.mock.calls[0]?.[1]).toBe('RG_TASLAKLAR')
    expect((call.mock.calls[0]?.[2] as Record<string, unknown>).hangiTip).toBe('Buyuk')
  })

  it('Date nesnelerini portal biçimine çevirir', async () => {
    const call = vi.fn().mockResolvedValue([])
    await new InvoiceService(gatewayMock(call)).listDrafts(
      new Date(2026, 8, 1),
      new Date(2026, 8, 3),
    )
    expect(call.mock.calls[0]?.[2]).toMatchObject({
      baslangic: '01/09/2026',
      bitis: '03/09/2026',
    })
  })

  it('dizi olmayan yanıtta boş liste döner', async () => {
    const call = vi.fn().mockResolvedValue(null)
    expect(
      await new InvoiceService(gatewayMock(call)).listDrafts('01/09/2026', '03/09/2026'),
    ).toEqual([])
  })
})

describe('InvoiceService.listIncoming', () => {
  it('adıma düzenlenen belgeleri sorgular', async () => {
    const call = vi.fn().mockResolvedValue([draftRow('a')])
    await new InvoiceService(gatewayMock(call)).listIncoming('01/09/2026', '03/09/2026')

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_ALICI_TASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({ baslangic: '01/09/2026', bitis: '03/09/2026' })
  })
})

describe('InvoiceService.getInvoice', () => {
  it('ETTN ile detay çeker', async () => {
    const call = vi.fn().mockResolvedValue({
      faturaUuid: 'abc',
      belgeNumarasi: 'GIB1',
      faturaTarihi: '03/09/2026',
      saat: '19:30:02',
      paraBirimi: 'TRY',
      dovzTLkur: 0,
      faturaTipi: 'SATIS',
      vknTckn: '11111111111',
      aliciAdi: 'Ali',
      malHizmetTable: [],
      not: '',
    })

    const detail = await new InvoiceService(gatewayMock(call)).getInvoice('abc')

    expect(call.mock.calls[0]?.[2]).toEqual({ ettn: 'abc' })
    expect(detail.ettn).toBe('abc')
    expect(detail.buyer.taxOrIdentityNumber).toBe('11111111111')
    expect(detail.raw).toBeDefined()
  })
})

describe('InvoiceService.cancelDraft', () => {
  it('özet satırını ve gerekçeyi gönderir', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([draftRow('silinecek')])
      .mockResolvedValueOnce('1 fatura başarıyla silindi.')

    await new InvoiceService(gatewayMock(call)).cancelDraft('silinecek', 'Yanlış işlem')

    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(payload.aciklama).toBe('Yanlış işlem')
    expect(payload.silinecekler).toEqual([
      {
        belgeNumarasi: 'GIB-silinecek',
        aliciVknTckn: '11111111111',
        aliciUnvanAdSoyad: 'Ali Yılmaz',
        belgeTarihi: '03/09/2026',
        belgeTuru: 'FATURA',
        ettn: 'silinecek',
      },
    ])
  })

  it('bulunamayan ETTN için hata fırlatır', async () => {
    const call = vi.fn().mockResolvedValueOnce([draftRow('baska')])
    await expect(
      new InvoiceService(gatewayMock(call)).cancelDraft('yok', 'gerekçe'),
    ).rejects.toThrow(/bulunamadı/)
  })
})
