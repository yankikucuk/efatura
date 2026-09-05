import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../config/index.js'
import { EArsivNetworkError } from '../core/index.js'

import { Endpoint } from './endpoints.js'
import { HttpClient } from './http-client.js'

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const clientWith = (fetchImpl: typeof globalThis.fetch, retryBackoffMs = 0): HttpClient =>
  new HttpClient(
    resolveClientOptions({
      environment: 'test',
      fetch: fetchImpl,
      retry: { backoffMs: retryBackoffMs },
    }),
  )

describe('HttpClient.postForm', () => {
  it('alanları form-urlencoded olarak gönderir', async () => {
    const fetchMock = vi.fn(() => json({ data: 'ok' }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await client.postForm(Endpoint.DISPATCH, { cmd: 'X', jp: '{"a":1}' })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://earsivportaltest.efatura.gov.tr/earsiv-services/dispatch')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded;charset=UTF-8')
    expect(headers.referer).toBe('https://earsivportaltest.efatura.gov.tr/intragiris.html')
    expect(headers['user-agent']).toContain('Mozilla/5.0')
    expect(init.body as string).toBe('cmd=X&jp=%7B%22a%22%3A1%7D')
  })

  it('Türkçe karakterleri UTF-8 olarak kodlar', async () => {
    const fetchMock = vi.fn(() => json({ data: 'ok' }))
    await clientWith(fetchMock as unknown as typeof globalThis.fetch).postForm(Endpoint.DISPATCH, {
      jp: '{"ulke":"Türkiye"}',
    })
    expect(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    ).toContain('T%C3%BCrkiye')
  })

  it('5xx yanıtını yeniden dener ve sonunda EArsivNetworkError fırlatır', async () => {
    const fetchMock = vi.fn(() => new Response('bozuk', { status: 503 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {})).rejects.toThrow(EArsivNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('geçici hatadan sonra başarılı denemeyi kabul eder', async () => {
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      if (call === 1) throw new TypeError('fetch failed')
      return json({ data: 'ikinci denemede' })
    })
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {})).resolves.toEqual({
      data: 'ikinci denemede',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('4xx yanıtını yeniden denemez', async () => {
    const fetchMock = vi.fn(() => new Response('yok', { status: 404 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {})).rejects.toThrow(EArsivNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('JSON olarak ayrıştırılamayan gövdede ağ hatası fırlatır', async () => {
    const fetchMock = vi.fn(() => new Response('<html>', { status: 200 }))
    await expect(
      clientWith(fetchMock as unknown as typeof globalThis.fetch).postForm(Endpoint.DISPATCH, {}),
    ).rejects.toThrow(EArsivNetworkError)
  })
})

describe('HttpClient.getBinary', () => {
  it('sorgu dizesi kurar ve baytları döndürür', async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const fetchMock = vi.fn(() => new Response(bytes, { status: 200 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    const result = await client.getBinary(Endpoint.DOWNLOAD, {
      token: 't',
      onayDurumu: 'Onaylanmadı',
    })

    expect(result).toEqual(bytes)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toContain('/earsiv-services/download?')
    expect(url).toContain('token=t')
    expect(url).toContain('onayDurumu=Onaylanmad%C4%B1')
  })

  it('boş gövdede ağ hatası fırlatır', async () => {
    const fetchMock = vi.fn(() => new Response(new Uint8Array(), { status: 200 }))
    await expect(
      clientWith(fetchMock as unknown as typeof globalThis.fetch).getBinary(Endpoint.DOWNLOAD, {}),
    ).rejects.toThrow(EArsivNetworkError)
  })
})
