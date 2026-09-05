/**
 * Müstahsil makbuzu servisi — oluşturma, listeleme, okuma.
 *
 * Portal makbuzlar için AYRI bir listeleme komutu sunmuyor: `hangiTip: 'Buyuk'`
 * ile alınan taslak listesi fatura + iki makbuz türünü birden içeren bir ÜST
 * KÜMEDİR ve makbuzlar `belgeTuru` ile süzülür. Bu yalnızca listelemeyi değil
 * ETTN ÇÖZÜMÜNÜ de etkiler: süzme olmadan aynı gün oluşturulmuş bir FATURA
 * anlık görüntü farkını kirletir, "iki yeni kayıt" bulunur ve (aynı alıcı ve
 * tarih yüzünden daraltma da başarısız olacağından) makbuz oluşturma
 * `EArsivAmbiguousResultError` ile REDDEDİLİRDİ. Ayrı bir test tam bu senaryoyu
 * kurar.
 *
 * Oluşturma ÜÇ istektir (listele → oluştur → yeniden listele) çünkü portal
 * ETTN döndürmüyor; `expect(call).toHaveBeenCalledTimes(3)` bu maliyeti
 * bilinçli olarak sabitler — bir "optimizasyon" sessizce ETTN çözümünü
 * bozamasın.
 *
 * Eşzamanlılık testi mlevent#101 vakasının makbuz karşılığıdır: aynı üreticiye
 * art arda makbuz kesmek olağandır ve serileştirme olmadan iki eşzamanlı
 * çağrının İKİSİ de belirsizlikten reddedilirdi — oysa portalda iki makbuz da
 * GERÇEKTEN oluşmuş olurdu. Sahte portal gerçek paylaşılan durum tutar ve her
 * çağrıyı bir makro-görevle geciktirir; elle sıralanmış bir mock kuyruğu bu
 * karışmayı üretemez, yani test yanlış nedenle yeşil kalamaz.
 */

import { describe, expect, it, vi } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import { Unit } from '../../constants/index.js'
import { EArsivAmbiguousResultError } from '../../core/index.js'
import type { DispatchGateway } from '../../transport/index.js'

import { ProducerReceiptService } from './producer-receipt.service.js'
import type { ProducerReceiptInput } from './producer-receipt.types.js'

const CREATED = portalResponses.producerReceiptCreated.data

const receiptRow = (ettn: string): Record<string, unknown> => ({
  belgeNumarasi: `GIB-${ettn}`,
  aliciVknTckn: '11111111111',
  belgeTarihi: '05-09-2026',
  belgeTuru: 'MÜSTAHSİL MAKBUZU',
  onayDurumu: 'Onaylanmadı',
  ettn,
})

const input: ProducerReceiptInput = {
  date: '05/09/2026',
  producer: { taxOrIdentityNumber: '11111111111', firstName: 'PROBE', lastName: 'MUSTAHSIL' },
  lineItems: [
    {
      name: 'Ceviz',
      quantity: 10,
      unit: Unit.KILOGRAM,
      unitPrice: 100,
      taxRates: { incomeTaxWithholding: 2 },
    },
  ],
}

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

describe('ProducerReceiptService.createReceipt', () => {
  // Kapsam: üç istekli ETTN çözümü, yükte kimlik alanı bulunmaması, ÜST KÜME
  // listesinden süzme (fatura kirliliği dahil), doğrulama kapısı,
  // belirsizlikte reddetme ve eşzamanlı çağrıların serileştirilmesi.
  it('anlık görüntü farkıyla ETTN çözer', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([receiptRow('eski')])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('eski'), receiptRow('yeni')])

    const result = await new ProducerReceiptService(gatewayMock(call)).createReceipt(input)

    expect(result).toEqual({
      ettn: 'yeni',
      documentNumber: 'GIB-yeni',
      date: '05/09/2026',
      approvalStatus: 'Onaylanmadı',
    })
    expect(call).toHaveBeenCalledTimes(3)
  })

  it('doğru komut ve sayfa adıyla gönderir; yükte kimlik alanı yoktur', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('yeni')])

    await new ProducerReceiptService(gatewayMock(call)).createReceipt(input)

    expect(call.mock.calls[1]?.[0]).toBe('EARSIV_PORTAL_MUSTAHSIL_OLUSTUR')
    expect(call.mock.calls[1]?.[1]).toBe('RG_MUSTAHSIL')
    const payload = call.mock.calls[1]?.[2] as Record<string, unknown>
    expect(payload).not.toHaveProperty('uuid')
    expect(payload).not.toHaveProperty('ettn')
    expect(payload.vknTckn).toBe('11111111111')
  })

  it('anlık görüntüyü ÜST KÜME listesinden alır ve makbuza süzer', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([receiptRow('yeni')])

    await new ProducerReceiptService(gatewayMock(call)).createReceipt(input)

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_TASLAKLARI_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_TASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({
      baslangic: '05/09/2026',
      bitis: '05/09/2026',
      hangiTip: 'Buyuk',
    })
  })

  it('aynı gün oluşturulmuş bir FATURA anlık görüntü farkını KİRLETMEZ', async () => {
    // hangiTip 'Buyuk' faturaları da döndürüyor. Süzme olmasaydı bu senaryoda
    // "iki yeni kayıt" bulunur ve aynı alıcı/tarih yüzünden daraltma da
    // başarısız olup EArsivAmbiguousResultError fırlatılırdı.
    const invoiceRow: Record<string, unknown> = {
      ...receiptRow('fatura-yeni'),
      belgeTuru: 'FATURA',
      aliciUnvanAdSoyad: 'PROBE MUSTAHSIL',
    }
    const call = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce([invoiceRow, receiptRow('makbuz-yeni')])

    const result = await new ProducerReceiptService(gatewayMock(call)).createReceipt(input)
    expect(result.ettn).toBe('makbuz-yeni')
  })

  it('geçersiz girdide ağa hiç çıkmaz', async () => {
    const call = vi.fn()
    await expect(
      new ProducerReceiptService(gatewayMock(call)).createReceipt({ ...input, lineItems: [] }),
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
      new ProducerReceiptService(gatewayMock(call)).createReceipt(input),
    ).rejects.toThrow(EArsivAmbiguousResultError)
  })

  it('aynı örnek üzerinden EŞZAMANLI iki çağrı ikisi de doğru, ayrı ETTN ile döner', async () => {
    // Fatura tarafındaki mlevent#101 vakasının aynısı: müstahsil makbuzları
    // aynı üreticiye art arda kesilir. Serileştirme olmasaydı iki çağrı da
    // aynı "önce" görüntüsünü görür ve ikisi de belirsizlikten REDDEDİLİRDİ —
    // oysa portalda iki makbuz da GERÇEKTEN oluşmuş olurdu.
    const drafts: Record<string, unknown>[] = []
    let seq = 0
    const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))
    const call = vi.fn(async (command: string) => {
      await tick()
      if (command === 'EARSIV_PORTAL_TASLAKLARI_GETIR') return drafts.map((row) => ({ ...row }))
      if (command === 'EARSIV_PORTAL_MUSTAHSIL_OLUSTUR') {
        seq += 1
        drafts.push(receiptRow(`ettn-${String(seq)}`))
        return CREATED
      }
      throw new Error(`beklenmeyen komut: ${command}`)
    })

    const service = new ProducerReceiptService(gatewayMock(call))
    const [first, second] = await Promise.all([
      service.createReceipt(input),
      service.createReceipt(input),
    ])

    expect(first.ettn).not.toBe(second.ettn)
    expect(new Set([first.ettn, second.ettn])).toEqual(new Set(['ettn-1', 'ettn-2']))
  })
})

describe('ProducerReceiptService.listReceipts', () => {
  // Kapsam: `hangiTip: 'Buyuk'` sorgusu + `belgeTuru` süzmesi. Fikstür
  // uydurulmuş değil, canlı portaldan yakalanmış bir yanıttır: iki müstahsil
  // + bir SMM satırı içerir, yani süzme gerçekten sınanıyor.
  it('ÜST KÜME listesini sorgular ve yalnızca müstahsil makbuzlarını döndürür', async () => {
    const call = vi.fn().mockResolvedValue(portalResponses.receiptDraftList.data)
    const rows = await new ProducerReceiptService(gatewayMock(call)).listReceipts(
      '05/09/2026',
      '05/09/2026',
    )

    expect(call.mock.calls[0]?.[2]).toMatchObject({ hangiTip: 'Buyuk' })
    // Fikstür gerçek bir portal yanıtı: iki müstahsil + bir SMM satırı.
    expect(rows.map((row) => row.documentType)).toEqual(['MÜSTAHSİL MAKBUZU', 'MÜSTAHSİL MAKBUZU'])
    expect(rows[0]?.ettn).toBe('caf584f7-2b42-4775-b6da-2e4d01bb534d')
    // Müstahsil satırında `aliciUnvanAdSoyad` alanı HİÇ YOK.
    expect(rows[0]?.buyerName).toBe('')
    expect(rows[0]?.date).toBe('05/09/2026')
  })

  it('dizi olmayan yanıtta boş liste döner', async () => {
    const call = vi.fn().mockResolvedValue(null)
    expect(
      await new ProducerReceiptService(gatewayMock(call)).listReceipts('05/09/2026', '05/09/2026'),
    ).toEqual([])
  })
})

describe('ProducerReceiptService.getReceipt', () => {
  // Kapsam: makbuzun KENDİ komut ve sayfa adıyla okunması (fatura komutuyla
  // değil) ve portalın kendi toplamlarının raporlanması.
  it('kendi komut ve sayfa adıyla detay çeker', async () => {
    const call = vi.fn().mockResolvedValue(portalResponses.producerReceiptDetail.data)
    const detail = await new ProducerReceiptService(gatewayMock(call)).getReceipt(
      'caf584f7-2b42-4775-b6da-2e4d01bb534d',
    )

    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_MUSTAHSIL_GETIR')
    expect(call.mock.calls[0]?.[1]).toBe('RG_MUSTAHSIL')
    expect(call.mock.calls[0]?.[2]).toEqual({ ettn: 'caf584f7-2b42-4775-b6da-2e4d01bb534d' })
    expect(detail.ettn).toBe('caf584f7-2b42-4775-b6da-2e4d01bb534d')
    expect(detail.totals.payableAmount).toBe(955)
    expect(detail.raw).toBeDefined()
  })
})
