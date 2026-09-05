/**
 * Belge gösterimi (HTML) ve resmi belge paketi (ZIP) indirme.
 *
 * `getHtml` bloğunun ağırlık merkezi bir PORTAL KUSURUNUN çevirisidir:
 * `EARSIV_PORTAL_FATURA_GOSTER`, geçerli bir serbest meslek makbuzu ETTN'i ile
 * ham bir Java istisnası ("String index out of range: 4") döndürüyor (canlı
 * doğrulandı 2026-09-05; müstahsilde AYNI komut sorunsuz çalışıyor).
 * Kullanıcı bu metni gördüğünde kendi kodunda hata arar; çeviri, kusurun
 * portalda olduğunu ve çalışan alternatifi söyleyen tipli bir hataya
 * (`EArsivPortalDefectError`) dönüştürür.
 *
 * Çevirinin İKİ sınırı ayrı testlerle pinlenmiştir, çünkü ikisi de yanlış
 * tarafa kaydığında zarar veriyor:
 * - Yalnızca BU metin çevrilir. Her API hatasını "portal kusuru" saymak gerçek
 *   iş kurallarını (yetki reddi, ön koşul) gizlerdi.
 * - Mesaj kullanıcıyı suçlamaz AMA kesin dille "senin hatan değil" de diyemez:
 *   aynı metin GEÇERSİZ/bilinmeyen bir ETTN'de de dönüyor (canlı doğrulandı —
 *   sıfır UUID, 'not-a-uuid' ve boş string, üçü de aynı istisnayı verdi). Bu
 *   yüzden mesaj her iki olasılığı da vermek ve önce kullanıcıya kendi ETTN'ini
 *   doğrulatmak zorunda.
 */

import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../../config/index.js'
import { EArsivApiError, EArsivPortalDefectError } from '../../core/index.js'
import type { DispatchGateway, HttpClient } from '../../transport/index.js'

import { DocumentService } from './document.service.js'

const options = resolveClientOptions({ environment: 'test' })
const tokens = { getToken: (): string => 'tok123', clearToken: (): void => undefined }

const build = (
  call = vi.fn(),
  getBinary = vi.fn(),
): { service: DocumentService; call: typeof call; getBinary: typeof getBinary } => {
  const service = new DocumentService(
    { call } as unknown as DispatchGateway,
    { getBinary } as unknown as HttpClient,
    tokens,
    options,
  )
  return { service, call, getBinary }
}

describe('DocumentService.getHtml', () => {
  // Kapsam: gösterim isteğinin yükü (varsayılan `Onaylanmadı`), portal
  // kusurunun tipli hataya çevrilmesi ve çevirinin KAPSAM SINIRI.
  it('onaylanmamış varsayılanıyla HTML çeker', async () => {
    const { service, call } = build(vi.fn().mockResolvedValue('<html>fatura</html>'))
    expect(await service.getHtml('abc')).toBe('<html>fatura</html>')
    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_FATURA_GOSTER')
    expect(call.mock.calls[0]?.[1]).toBe('RG_TASLAKLAR')
    expect(call.mock.calls[0]?.[2]).toEqual({ ettn: 'abc', onayDurumu: 'Onaylanmadı' })
  })

  it('signed: true onay durumunu değiştirir', async () => {
    const { service, call } = build(vi.fn().mockResolvedValue('<html/>'))
    await service.getHtml('abc', { signed: true })
    expect((call.mock.calls[0]?.[2] as Record<string, unknown>).onayDurumu).toBe('Onaylandı')
  })

  it('portalın Java istisnasını ham hâlde geçirmez, portal kusuru hatasına çevirir', async () => {
    // Bir SMM ETTN'i bu yola getInvoiceHtml/toPdf üzerinden de girebilir;
    // orada kullanıcı "String index out of range: 4" görür ve bunu kendi
    // hatası sanar. Çeviri olmadan bu vaka tamamen açıkta kalırdı.
    const apiError = new EArsivApiError('String index out of range: 4', {
      command: 'EARSIV_PORTAL_FATURA_GOSTER',
      callId: 'x',
      raw: { error: '1', messages: ['String index out of range: 4'] },
    })
    const { service } = build(vi.fn().mockRejectedValue(apiError))

    const rejection = service.getHtml('abc-smm')
    await expect(rejection).rejects.toThrow(EArsivPortalDefectError)
    await rejection.catch((error: unknown) => {
      const defect = error as EArsivPortalDefectError
      expect(defect.portalMessage).toBe('String index out of range: 4')
      expect(defect.message).toMatch(/[Ss]erbest [Mm]eslek/)
      expect(defect.message).toContain('getSelfEmployedReceipt')
      // Orijinal hata kaybolmamalı.
      expect(defect.cause).toBe(apiError)
    })
  })

  it('aynı metnin GEÇERSİZ ETTN sebebiyle de geldiğini söyler', async () => {
    // Portal bu Java istisnasını YALNIZCA serbest meslek makbuzlarında
    // döndürmüyor: var olmayan ya da hatalı biçimli bir ETTN de aynı metni
    // üretiyor (canlı doğrulandı 2026-09-05 — sıfır UUID, 'not-a-uuid' ve
    // boş string, üçü de "String index out of range: 4").
    //
    // Bu yüzden mesaj bunun bir kullanım hatası OLMADIĞINI kesin dille
    // söyleyemez: ETTN'ini yanlış yazan kullanıcıyı, aslında kendi
    // hatasıyken portalda kusur aramaya gönderirdi. Mesaj her iki olasılığı
    // da vermek zorunda.
    const apiError = new EArsivApiError('String index out of range: 4', {
      command: 'EARSIV_PORTAL_FATURA_GOSTER',
      callId: 'x',
      raw: { error: '1', messages: ['String index out of range: 4'] },
    })
    const { service } = build(vi.fn().mockRejectedValue(apiError))

    const rejection = service.getHtml('yanlis-ettn')
    await rejection.catch((error: unknown) => {
      const defect = error as EArsivPortalDefectError
      // ETTN'in yanlış/bilinmeyen olabileceği açıkça geçmeli.
      expect(defect.message).toMatch(/bilinmeyen|hatalı|yanlış|mevcut değil/i)
      // Ve kullanıcıya önce kendi girdisini doğrulatmalı.
      expect(defect.message).toMatch(/ETTN'i(nizi)? (doğrulayın|kontrol edin)|doğrulayın/i)
    })
  })

  it('ALAKASIZ bir portal hatasını olduğu gibi bırakır', async () => {
    // Çeviri yalnızca bilinen kusur metnine uygulanmalı; her hatayı
    // "portal kusuru" diye etiketlemek gerçek iş hatalarını gizlerdi.
    const apiError = new EArsivApiError('Bu işlem için yetkiniz yok', {
      command: 'EARSIV_PORTAL_FATURA_GOSTER',
      callId: 'x',
      raw: {},
    })
    const { service } = build(vi.fn().mockRejectedValue(apiError))
    await expect(service.getHtml('abc')).rejects.toBe(apiError)
  })
})

describe('DocumentService.downloadPackage', () => {
  // Kapsam: ZIP yolu dispatch'ten DEĞİL, ayrı bir GET uç noktasından geçer ve
  // token'ı sorgu dizesinde taşır. Yükün beş alanı sabitlenir; eksik ya da
  // yanlış alanda portal oturumu geçersiz sayıyor. Bu uç noktanın oturumu
  // AÇAN istemcinin IP'sine bağlı olması birim testinde gözlenemez (bkz.
  // README, "İndirme uç noktası istemci IP'sine bağlıdır").
  it('ZIP baytlarını döndürür', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])
    const { service, getBinary } = build(vi.fn(), vi.fn().mockResolvedValue(zip))

    const result = await service.downloadPackage('abc')

    expect(result).toBe(zip)
    expect(getBinary.mock.calls[0]?.[0]).toBe('/earsiv-services/download')
    expect(getBinary.mock.calls[0]?.[1]).toEqual({
      token: 'tok123',
      ettn: 'abc',
      belgeTip: 'FATURA',
      onayDurumu: 'Onaylanmadı',
      cmd: 'EARSIV_PORTAL_BELGE_INDIR',
    })
  })

  it('dönen baytlar ZIP imzasıyla başlar', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const { service } = build(vi.fn(), vi.fn().mockResolvedValue(zip))
    const result = await service.downloadPackage('abc')
    expect(Array.from(result.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})

describe('DocumentService.getDownloadUrl', () => {
  // Kapsam: aynı adresin indirme YAPILMADAN üretilmesi (kullanıcı URL'yi
  // kendi HTTP yığınına verebilsin diye). `downloadPackage` ile aynı
  // parametreleri ürettiği burada pinlenir; ikisi ayrışırsa biri çalışırken
  // diğeri "Oturum geçersiz" verirdi.
  it('tam indirme adresini kurar', () => {
    const { service } = build()
    const url = service.getDownloadUrl('abc', { signed: true })
    expect(url).toContain('https://earsivportaltest.efatura.gov.tr/earsiv-services/download?')
    expect(url).toContain('token=tok123')
    expect(url).toContain('ettn=abc')
    expect(url).toContain('belgeTip=FATURA')
    expect(url).toContain('onayDurumu=Onayland%C4%B1')
    expect(url).toContain('cmd=EARSIV_PORTAL_BELGE_INDIR')
  })
})
