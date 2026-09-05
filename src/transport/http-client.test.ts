import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../config/index.js'
import { EArsivNetworkError } from '../core/index.js'

import { Endpoint } from './endpoints.js'
import { HttpClient } from './http-client.js'

// round 2 madde 5: PostFormOptions HttpClient.postForm'un genel bir
// parametre tipi ama transport/index.js'ten dışa açık DEĞİLDİ — bir
// kullanıcı bir literal geçirebiliyordu ama tipi adlandıramıyordu. Bu
// import barrel'dan (index.js) geliyor, doğrudan http-client.js'ten değil —
// tsc'nin barrel export'unu görüp görmediğini pinlemek için kasıtlı.
import type { PostFormOptions } from './index.js'

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

describe('PostFormOptions dışa açıklığı (round 2 madde 5)', () => {
  it('transport/index.js barrel üzerinden adlandırılabilir', () => {
    const options: PostFormOptions = { retryable: true }
    expect(options.retryable).toBe(true)
  })
})

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

  it('5xx yanıtını yeniden dener ve HTTP durumunu koruyarak fırlatır (retryable: true)', async () => {
    const fetchMock = vi.fn(() => new Response('bozuk', { status: 503 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    // Yalnızca hata sınıfını ve çağrı sayısını kontrol etmek yetmez: send()
    // içindeki `instanceof EArsivNetworkError` yeniden-fırlatma koruması
    // silinseydi hata genel "Portala ulaşılamadı." mesajıyla ve status
    // olmadan yeniden sarılırdı, ama sınıf ve çağrı sayısı aynı kalırdı.
    // status ve attempts alanlarını sabitlemek korumayı gerçekten pinler.
    await expect(client.postForm(Endpoint.DISPATCH, {}, { retryable: true })).rejects.toMatchObject(
      {
        status: 503,
        attempts: 3,
      },
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retryable belirtilmezse 5xx yanıtını TEK denemede fırlatır (C1)', async () => {
    // Varsayılan güvenli taraf: bayrak verilmeyen bir komut yeniden
    // denenmez. Bu test bilerek {retryable: true} vermiyor — bayrağın
    // gerçekten varsayılan false olduğunu pinler. Bayrak geçici olarak
    // true'ya çevrilirse (ör. "|| true" eklenirse) bu test 3 çağrı görür ve
    // kırılır.
    const fetchMock = vi.fn(() => new Response('bozuk', { status: 503 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {})).rejects.toMatchObject({
      status: 503,
      attempts: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ayrıştırılamayan gövdede GERÇEK deneme sayısını bildirir', async () => {
    // İlk denemede 5xx, ikincide ayrıştırılamayan 200: attempts 2 olmalı,
    // yapılandırılmış tavan olan 3 değil.
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      return call === 1
        ? new Response('bozuk', { status: 503 })
        : new Response('<html>', { status: 200 })
    })
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {}, { retryable: true })).rejects.toMatchObject(
      { attempts: 2 },
    )
  })

  it('geçici hatadan sonra başarılı denemeyi kabul eder', async () => {
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      if (call === 1) throw new TypeError('fetch failed')
      return json({ data: 'ikinci denemede' })
    })
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {}, { retryable: true })).resolves.toEqual({
      data: 'ikinci denemede',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('4xx yanıtını yeniden denemez', async () => {
    const fetchMock = vi.fn(() => new Response('yok', { status: 404 }))
    const client = clientWith(fetchMock as unknown as typeof globalThis.fetch)

    await expect(client.postForm(Endpoint.DISPATCH, {}, { retryable: true })).rejects.toThrow(
      EArsivNetworkError,
    )
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

  it('boş gövde hatasında gerçek deneme sayısını bildirir', async () => {
    // İlk denemede 5xx, ikincide boş gövdeli 200: attempts 2 olmalı, 1 değil.
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      return call === 1
        ? new Response('bozuk', { status: 503 })
        : new Response(new Uint8Array(), { status: 200 })
    })
    await expect(
      clientWith(fetchMock as unknown as typeof globalThis.fetch).getBinary(Endpoint.DOWNLOAD, {}),
    ).rejects.toMatchObject({ attempts: 2 })
  })

  it('token ASLA EArsivNetworkError.url içinde veya logger bağlamında ham görünmez (I1)', async () => {
    // getBinary token'ı sorgu dizesinde taşır (`…/download?token=<128 hane>&…`).
    // Bu URL hem yeniden deneme günlüğüne hem de EArsivNetworkError.url'e
    // gidiyordu — logger.types.ts "hassas veri (token, şifre) buraya
    // konmaz" diye söz veriyor. İlk denemede 5xx (debug log tetikler),
    // ikincide boş gövde (nihai hata) — böylece HEM log HEM hata yolu
    // tek testte doğrulanır.
    const SECRET_TOKEN = 'S'.repeat(128)
    let call = 0
    const fetchMock = vi.fn(() => {
      call += 1
      return call === 1
        ? new Response('bozuk', { status: 503 })
        : new Response(new Uint8Array(), { status: 200 })
    })
    const debug = vi.fn()
    const client = new HttpClient(
      resolveClientOptions({
        environment: 'test',
        fetch: fetchMock as unknown as typeof globalThis.fetch,
        retry: { backoffMs: 0 },
        logger: { debug, info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      }),
    )

    let networkError: EArsivNetworkError | undefined
    try {
      await client.getBinary(Endpoint.DOWNLOAD, { token: SECRET_TOKEN })
    } catch (error) {
      networkError = error as EArsivNetworkError
    }

    expect(networkError).toBeInstanceOf(EArsivNetworkError)
    expect(networkError?.url).not.toContain(SECRET_TOKEN)
    expect(networkError?.url).toContain('token=***')

    expect(debug).toHaveBeenCalledTimes(1)
    const loggedContext = JSON.stringify(debug.mock.calls[0])
    expect(loggedContext).not.toContain(SECRET_TOKEN)
  })
})
