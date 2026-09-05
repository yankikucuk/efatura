import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../../config/index.js'
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
})

describe('DocumentService.downloadPackage', () => {
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
