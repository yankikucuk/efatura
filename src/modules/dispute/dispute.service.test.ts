/**
 * İptal/itiraz talebi oluşturma, listeleme ve cevaplama.
 *
 * Buradaki en pahalı hata SESSİZDİR: iki itiraz yükü AYNI portal komutunu
 * (`EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR`) kullanır ve yalnızca `pageName` ile
 * ayrışır — kendi belgeniz `RG_TASLAKLAR`, adınıza düzenlenmiş belge
 * `RG_ALICI_TASLAKLAR`. Yanlış eşleşme "Bu işlem için yetkiniz yok" veriyor,
 * yani hata metni sorunu göstermiyor. Yalnızca komut adını doğrulayan bir test
 * iki değişkeni de yeşil geçirirdi; bu yüzden `pageName` ayrıca sabitleniyor.
 *
 * "Dizi olmayan yanıtı boş listeye çevirir" testi, projede yakalanan yedi
 * "adını taşıdığı davranışı sabitlemeyen test" vakasından biridir. İlk hâli
 * BOŞ BİR DİZİ (`[]`) ile yazılmıştı — `[]` zaten geçerli bir dizidir, yani
 * `asRows` içindeki `Array.isArray` koruması SİLİNSE DE test geçerdi ve adı
 * ("boş listeyi tolere eder") hiçbir davranışı sabitlemiyordu. Vaka, dizi
 * OLMAYAN bir yanıtla (`null`) değiştirildi; koruma olmadan çağıran `.map()`
 * üzerinde `TypeError` alırdı. Aynı ders iki makbuz servisindeki benzer
 * testlere de uygulandı.
 */

import { describe, expect, it, vi } from 'vitest'

import { ApprovalStatus, DisputeAnswer, DisputeMethod } from '../../constants/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { DisputeService } from './dispute.service.js'

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('DisputeService.createCancellationRequest', () => {
  // Kapsam: iptal talebi yükü (dört alan) ve geçersiz girdide ağa HİÇ
  // çıkılmaması. Talep geri alınamaz ve belge başına bir kez açılır.
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
  // Kapsam: KENDİ belgenize itiraz — yedi alanlı yük, `RG_TASLAKLAR` sayfası.
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

describe('DisputeService.createObjectionRequestForIncoming', () => {
  // Kapsam: ADINIZA düzenlenmiş (portal veya entegratör) belgeye itiraz — on
  // bir alanlı yük ve FARKLI `pageName`. Kütüphanenin belgelediği asıl
  // kullanım durumu budur.
  it('on bir alanlı yükü RG_ALICI_TASLAKLAR sayfasına gönderir', async () => {
    const call = vi.fn().mockResolvedValue('başarıyla')

    await new DisputeService(gatewayMock(call)).createObjectionRequestForIncoming({
      ettn: 'abc',
      invoiceOid: '999',
      totalAmount: 120,
      sellerTaxOrIdentityNumber: '9999999999',
      documentNumber: 'GIB123',
      method: DisputeMethod.NOTARY,
      referenceDocumentId: '2026/42',
      referenceDocumentDate: new Date(2026, 8, 3),
      reason: 'Hizmet alınmadı',
    })

    // pageName KASITLI olarak createObjectionRequest'in gönderdiği
    // RG_TASLAKLAR'DAN FARKLI — bu ayrım Fix 2'nin bütün amacı. Yalnızca
    // komut adını doğrulayan bir test, iki değişkeni de yeşil geçirirdi.
    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_ALICI_TASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      ettn: 'abc',
      faturaOid: '999',
      toplamTutar: '120.00',
      saticiVknTckn: '9999999999',
      belgeNumarasi: 'GIB123',
      onayDurumu: 'Onaylandı',
      belgeTuru: 'FATURA',
      itirazYontemi: 'NOTER',
      referansBelgeId: '2026/42',
      referansBelgeTarihi: '03/09/2026',
      talepAciklama: 'Hizmet alınmadı',
    })
  })

  it('geçersiz girdide (dört alandan biri eksik) ağa çıkmaz', async () => {
    const call = vi.fn()
    await expect(
      new DisputeService(gatewayMock(call)).createObjectionRequestForIncoming({
        ettn: 'abc',
        invoiceOid: '',
        totalAmount: 120,
        sellerTaxOrIdentityNumber: '9999999999',
        documentNumber: 'GIB123',
        method: DisputeMethod.NOTARY,
        referenceDocumentId: '2026/42',
        referenceDocumentDate: new Date(2026, 8, 3),
        reason: 'Hizmet alınmadı',
      }),
    ).rejects.toThrow(/invoiceOid|portal içi kayıt/i)
    expect(call).not.toHaveBeenCalled()
  })
})

describe('DisputeService.listRequests', () => {
  // Kapsam: tarih aralıklı sorgu, satır eşlemesi ve dizi OLMAYAN yanıtın
  // tolere edilmesi (gerekçesi dosya başlığında). İptal ve itiraz talepleri
  // aynı listede döner; ayrım `kind` (`iptalItiraz`) alanındadır.
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
  // Kapsam: kabul/ret cevabı. Kabulde `retAciklama` alanı KALDIRILMAZ, boş
  // string olarak gönderilir — portal eksik anahtarı reddediyor.
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
