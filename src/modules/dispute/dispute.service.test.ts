import { describe, expect, it, vi } from 'vitest'

import { ApprovalStatus, DisputeAnswer, DisputeMethod } from '../../constants/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { DisputeService } from './dispute.service.js'

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('DisputeService.createCancellationRequest', () => {
  it('doğrulanmış yükü gönderir', async () => {
    const call = vi.fn().mockResolvedValue('Talebiniz başarıyla oluşturuldu.')

    await new DisputeService(gatewayMock(call)).createCancellationRequest({
      ettn: 'abc',
      reason: 'Yanlış tutar',
    })

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_TASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      ettn: 'abc',
      onayDurumu: 'Onaylandı',
      belgeTuru: 'FATURA',
      talepAciklama: 'Yanlış tutar',
    })
  })

  it('onay durumu geçersiz kılınabilir', async () => {
    const call = vi.fn().mockResolvedValue('başarıyla')
    await new DisputeService(gatewayMock(call)).createCancellationRequest({
      ettn: 'abc',
      reason: 'x',
      approvalStatus: ApprovalStatus.NOT_APPROVED,
    })
    expect((call.mock.calls[0]?.[2] as Record<string, unknown>).onayDurumu).toBe('Onaylanmadı')
  })

  it('geçersiz girdide ağa çıkmaz', async () => {
    const call = vi.fn()
    await expect(
      new DisputeService(gatewayMock(call)).createCancellationRequest({ ettn: 'a', reason: '' }),
    ).rejects.toThrow(/gerekçe/i)
    expect(call).not.toHaveBeenCalled()
  })
})

describe('DisputeService.createObjectionRequest', () => {
  it('yedi alanlı yükü gönderir', async () => {
    const call = vi.fn().mockResolvedValue('başarıyla')

    await new DisputeService(gatewayMock(call)).createObjectionRequest({
      ettn: 'abc',
      method: DisputeMethod.NOTARY,
      referenceDocumentId: '2026/42',
      referenceDocumentDate: new Date(2026, 8, 3),
      reason: 'Hizmet alınmadı',
    })

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      ettn: 'abc',
      onayDurumu: 'Onaylandı',
      belgeTuru: 'FATURA',
      itirazYontemi: 'NOTER',
      referansBelgeId: '2026/42',
      referansBelgeTarihi: '03/09/2026',
      talepAciklama: 'Hizmet alınmadı',
    })
  })
})

describe('DisputeService.listRequests', () => {
  it('tarih aralığını gönderir ve satırları eşler', async () => {
    const call = vi.fn().mockResolvedValue([
      {
        belgeNumarasi: 'GIB1',
        belgeTuru: 'FATURA',
        iptalItiraz: '1',
        iptalItirazDurumu: '0',
        iptalItirazOid: '77',
        itirazYontemi: 'KEP',
      },
    ])

    const result = await new DisputeService(gatewayMock(call)).listRequests(
      '01/09/2026',
      '03/09/2026',
    )

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_IPTALITIRAZTASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({ baslangic: '01/09/2026', bitis: '03/09/2026' })
    expect(result[0]).toEqual({
      disputeId: '77',
      documentNumber: 'GIB1',
      documentType: 'FATURA',
      kind: '1',
      status: '0',
      method: 'KEP',
    })
  })

  it('dizi olmayan yanıtı boş listeye çevirir', async () => {
    const call = vi.fn().mockResolvedValue(null)
    expect(
      await new DisputeService(gatewayMock(call)).listRequests('01/09/2026', '03/09/2026'),
    ).toEqual([])
  })
})

describe('DisputeService.respondToRequest', () => {
  it('kabul cevabında ret açıklamasını boş gönderir', async () => {
    const call = vi.fn().mockResolvedValue('başarıyla')

    await new DisputeService(gatewayMock(call)).respondToRequest({
      disputeId: '77',
      answer: DisputeAnswer.ACCEPT,
    })

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_IPTAL_ITIRAZ_TALEP_DURUM_GUNCELLE')
    expect(call.mock.calls[0]?.[2]).toEqual({
      iptalItirazOid: '77',
      talepCevabi: '1',
      belgeTuru: 'FATURA',
      retAciklama: '',
    })
  })

  it('ret cevabında gerekçeyi gönderir', async () => {
    const call = vi.fn().mockResolvedValue('başarıyla')
    await new DisputeService(gatewayMock(call)).respondToRequest({
      disputeId: '77',
      answer: DisputeAnswer.REJECT,
      rejectionReason: 'Talep haksız',
    })
    expect((call.mock.calls[0]?.[2] as Record<string, unknown>).retAciklama).toBe('Talep haksız')
  })
})
