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

  it('tutarsız totals override ağa çıkmadan reddedilir (coverage: mergeAndVerifyTotals ön kontrolü)', async () => {
    // createDraft, toPortalInvoice'u çağırmadan ÖNCE de mergeAndVerifyTotals'ı
    // çalıştırır — bozuk bir override'ın ağa gitmesini engelleyen bu ön
    // kontrol silinse bile toPortalInvoice kendi içinde aynı hesabı tekrar
    // yaptığı için suit yine yeşil kalabilir. Bu test doğrudan `call`'ın hiç
    // tetiklenmediğini pinleyerek o ön kontrolü gerçekten kilitliyor.
    const call = vi.fn()
    await expect(
      new InvoiceService(gatewayMock(call)).createDraft({
        ...input,
        totals: { taxBase: 999_999 },
      }),
    ).rejects.toThrow(/tutarsız/)
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

  it('round 3 madde 3: aynı alıcı/tarih için EŞZAMANLI iki çağrı ikisi de doğru, ayrı ETTN ile döner (mlevent#101)', async () => {
    // mlevent#101 (açık, Mayıs 2026): aynı alıcıya (nihai tüketici TCKN'i
    // 11111111111 olduğunda kaçınılmaz) art arda iki fatura kesilince ETTN
    // karışıyor. Bizim anlık görüntü-farkı tasarımımız TAHMİN etmiyor — ama
    // serileştirme olmadan iki eşzamanlı createDraft çağrısı da
    // EArsivAmbiguousResultError ile RET ediliyordu, oysa portalda İKİ
    // fatura da GERÇEKTEN oluşmuştu. İki dosyalanmış fatura + iki hata, tek
    // seferde serileştirmekten daha kötü bir sonuç.
    //
    // Sahte portal GERÇEK paylaşılan durumu (drafts dizisi) tutar ve her
    // çağrıyı gerçek bir setTimeout makro-görevi ile geciktirir; bu, elle
    // sıralanmış bir mock kuyruğunun aksine, iki çağrının GERÇEKTEN
    // birbirine karışmasına izin verir — serileştirme yoksa bu test o
    // karışmayı GERÇEKTEN üretir, serileştirme varsa üretmez. Böylece test
    // yanlış nedenle YEŞİL kalamaz.
    const drafts: Record<string, unknown>[] = []
    let seq = 0
    const networkTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
    const call = vi.fn(async (command: string) => {
      await networkTick()
      if (command === 'EARSIV_PORTAL_TASLAKLARI_GETIR') {
        return drafts.map((row) => ({ ...row }))
      }
      if (command === 'EARSIV_PORTAL_FATURA_OLUSTUR') {
        seq += 1
        drafts.push(draftRow(`ettn-${String(seq)}`))
        return 'Faturanız başarıyla oluşturulmuştur.'
      }
      throw new Error(`beklenmeyen komut: ${command}`)
    })

    const service = new InvoiceService(gatewayMock(call))
    const [first, second] = await Promise.all([
      service.createDraft(input),
      service.createDraft(input),
    ])

    expect(first.ettn).not.toBe(second.ettn)
    expect(new Set([first.ettn, second.ettn])).toEqual(new Set(['ettn-1', 'ettn-2']))
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

describe('InvoiceService.listIncomingExternal', () => {
  const externalRow = (ettn: string): Record<string, unknown> => ({
    ettn,
    belgeNumarasi: `GIB-${ettn}`,
    faturaNo: `ENT-${ettn}`,
    saticiVknTckn: '9999999999',
    saticiUnvanAdSoyad: 'Entegratör Satıcı A.Ş.',
    belgeTarihi: '03-09-2026',
    belgeTuru: 'FATURA',
    onayDurumu: 'Onaylandı',
  })

  it('entegratör komutunu ve doğru sayfa adını gönderir, filtresiz çağrıda boş string kullanır', async () => {
    const call = vi.fn().mockResolvedValue([externalRow('a')])
    await new InvoiceService(gatewayMock(call)).listIncomingExternal('01/09/2026', '03/09/2026')

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_ENTEGRATOR_ADIMA_DUZENLENENLER_SORGULA')
    // pageName kasıtlı olarak RG_ALICI_TASLAKLAR'DAN FARKLI: yanlış sayfa
    // adı "Bu işlem için yetkiniz yok" hatasına yol açar (bkz. rapor).
    expect(call.mock.calls[0]?.[1]).toBe('RG_ALICI_ENTEGRATOR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      saticiVknTckn: '',
      belgeTuru: '',
      faturaNo: '',
      baslangic: '01/09/2026',
      bitis: '03/09/2026',
    })
  })

  it('verilen filtreleri yükte gönderir', async () => {
    const call = vi.fn().mockResolvedValue([])
    await new InvoiceService(gatewayMock(call)).listIncomingExternal('01/09/2026', '03/09/2026', {
      sellerTaxOrIdentityNumber: '9999999999',
      documentType: 'FATURA',
      invoiceNumber: 'ENT-42',
    })

    expect(call.mock.calls[0]?.[2]).toEqual({
      saticiVknTckn: '9999999999',
      belgeTuru: 'FATURA',
      faturaNo: 'ENT-42',
      baslangic: '01/09/2026',
      bitis: '03/09/2026',
    })
  })

  it('satırları satıcı kimliğiyle eşler (toInvoiceSummary DEĞİL)', async () => {
    const call = vi.fn().mockResolvedValue([externalRow('a')])
    const [result] = await new InvoiceService(gatewayMock(call)).listIncomingExternal(
      '01/09/2026',
      '03/09/2026',
    )

    expect(result).toEqual({
      ettn: 'a',
      documentNumber: 'GIB-a',
      invoiceNumber: 'ENT-a',
      sellerTaxOrIdentityNumber: '9999999999',
      sellerName: 'Entegratör Satıcı A.Ş.',
      date: '03/09/2026',
      documentType: 'FATURA',
      approvalStatus: 'Onaylandı',
    })
  })

  it('dizi olmayan yanıtı boş listeye çevirir', async () => {
    const call = vi.fn().mockResolvedValue(null)
    expect(
      await new InvoiceService(gatewayMock(call)).listIncomingExternal('01/09/2026', '03/09/2026'),
    ).toEqual([])
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

  it('boş malHizmet alanlı satırda hata FIRLATMAZ, detayı döndürür (I4)', () => {
    const call = vi.fn().mockResolvedValue({
      belgeNumarasi: 'GIB1',
      faturaTarihi: '03/09/2026',
      vknTckn: '11111111111',
      malHizmetTable: [
        { malHizmet: '', miktar: 1, birim: 'C62', birimFiyat: '100,00', kdvOrani: 20 },
      ],
    })

    return expect(new InvoiceService(gatewayMock(call)).getInvoice('abc')).resolves.toMatchObject({
      lineItems: [expect.objectContaining({ name: '' })],
    })
  })

  it('boş faturaTarihi alanında hata FIRLATMAZ, ham stringi döner (round 2 madde 3)', async () => {
    // Aynı str() kör noktası I5'te listelerde yamanmıştı; okuma yolunda
    // (getInvoice) yamasızdı — formatPortalDate(input.date) boş stringde
    // fırlıyor ve çağıran detail.raw'a bile erişemiyordu.
    const call = vi.fn().mockResolvedValue({
      belgeNumarasi: 'GIB1',
      faturaTarihi: '',
      vknTckn: '11111111111',
      malHizmetTable: [],
    })

    const detail = await new InvoiceService(gatewayMock(call)).getInvoice('abc')
    expect(detail.date).toBe('')
    expect(detail.raw).toBeDefined()
  })

  it('portalın kendi toplamlarını raporlar, kalemlerden yeniden hesaplamaz (I4)', async () => {
    // Portal matrah/kdv/toplam alanlarını gönderiyor; bu kütüphanenin kendi
    // aritmetiği (kalemlerden hesaplanan) bunlarla KASITLI olarak
    // uyuşmuyor — böylece hangi kaynağın raporlandığı ayırt edilebiliyor.
    const call = vi.fn().mockResolvedValue({
      belgeNumarasi: 'GIB1',
      faturaTarihi: '03/09/2026',
      vknTckn: '11111111111',
      malHizmetTable: [
        { malHizmet: 'Danışmanlık', miktar: 1, birim: 'C62', birimFiyat: '1.234,56', kdvOrani: 20 },
      ],
      // Portalın kendi (gerçek dünyada kalem toplamıyla eşleşmesi gereken,
      // ama testte bilerek FARKLI verilen) resmi rakamları:
      matrah: '1.234,56',
      malhizmetToplamTutari: '1.234,56',
      toplamIskonto: '0,00',
      hesaplanankdv: '999,99',
      vergilerToplami: '999,99',
      vergilerDahilToplamTutar: '2.234,55',
      odenecekTutar: '2.234,55',
    })

    const detail = await new InvoiceService(gatewayMock(call)).getInvoice('abc')

    expect(detail.lineItems[0]?.unitPrice).toBe(1234.56)
    expect(detail.totals).toEqual({
      lineTotal: 1234.56,
      totalDiscount: 0,
      taxBase: 1234.56,
      calculatedVat: 999.99,
      additionalTaxes: 0,
      totalTaxes: 999.99,
      grandTotal: 2234.55,
      payableAmount: 2234.55,
    })
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

  it('dünün tarihiyle sağlanan taslağı bulur ve siler (I10)', async () => {
    // Eski davranış her iki aramayı da bugüne sabitliyordu; dünkü bir
    // taslak bu API üzerinden asla silinemiyordu.
    const call = vi
      .fn()
      .mockResolvedValueOnce([draftRow('dunku')])
      .mockResolvedValueOnce('1 fatura başarıyla silindi.')

    await new InvoiceService(gatewayMock(call)).cancelDraft('dunku', 'gerekçe', {
      date: '02/09/2026',
    })

    expect(call.mock.calls[0]?.[2]).toMatchObject({
      baslangic: '02/09/2026',
      bitis: '02/09/2026',
    })
  })

  it('date verilmezse bugünü aramaya devam eder', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([draftRow('bugunku')])
      .mockResolvedValueOnce('1 fatura başarıyla silindi.')

    await new InvoiceService(gatewayMock(call)).cancelDraft('bugunku', 'gerekçe')

    const today = call.mock.calls[0]?.[2] as Record<string, unknown>
    expect(today.baslangic).toBe(today.bitis)
  })

  it('bulunamayan ETTN hata mesajı aranan tarih aralığını belirtir (I10)', async () => {
    const call = vi.fn().mockResolvedValueOnce([draftRow('baska')])
    await expect(
      new InvoiceService(gatewayMock(call)).cancelDraft('yok', 'gerekçe', {
        date: '02/09/2026',
      }),
    ).rejects.toThrow(/02\/09\/2026/)
  })
})
