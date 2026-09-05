import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../config/index.js'
import { Command, PageName } from '../constants/index.js'
import { EArsivApiError, EArsivAuthError, EArsivNetworkError } from '../core/index.js'

import { DispatchGateway } from './dispatch.gateway.js'
import { HttpClient } from './http-client.js'

const gatewayWith = (
  fetchImpl: typeof globalThis.fetch,
  token = 'test-token',
  clearToken: () => void = () => undefined,
): DispatchGateway => {
  const options = resolveClientOptions({ environment: 'test', fetch: fetchImpl })
  return new DispatchGateway(new HttpClient(options), { getToken: () => token, clearToken })
}

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

describe('DispatchGateway.call', () => {
  it('beş zorunlu alanı gönderir', async () => {
    const fetchMock = vi.fn(() => json({ data: 'ok' }))
    await gatewayWith(fetchMock as unknown as typeof globalThis.fetch).call(
      Command.GET_INVOICE,
      PageName.INVOICE_FORM,
      { ettn: 'abc' },
    )

    const body = new URLSearchParams(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.get('cmd')).toBe('EARSIV_PORTAL_FATURA_GETIR')
    expect(body.get('pageName')).toBe('RG_BASITFATURA')
    expect(body.get('token')).toBe('test-token')
    expect(body.get('jp')).toBe('{"ettn":"abc"}')
    expect(body.get('callid')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('her çağrı için yeni bir callid üretir', async () => {
    const fetchMock = vi.fn(() => json({ data: 'ok' }))
    const gateway = gatewayWith(fetchMock as unknown as typeof globalThis.fetch)
    await gateway.call(Command.GET_USER_INFO, PageName.USER, {})
    await gateway.call(Command.GET_USER_INFO, PageName.USER, {})

    const ids = fetchMock.mock.calls.map((call) =>
      new URLSearchParams((call as unknown as [string, RequestInit])[1].body as string).get(
        'callid',
      ),
    )
    expect(ids[0]).not.toBe(ids[1])
  })

  it('portal iş mantığı hatasını EArsivApiError olarak yükseltir ve callid taşır', async () => {
    const fetchMock = vi.fn(() =>
      json({ error: '1', messages: [{ type: '7', text: 'Form parametrelerinde sorun var' }] }),
    )
    const gateway = gatewayWith(fetchMock as unknown as typeof globalThis.fetch)

    try {
      await gateway.call(Command.GET_USER_INFO, PageName.USER, {})
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      const api = error as EArsivApiError
      expect(api).toBeInstanceOf(EArsivApiError)
      expect(api.command).toBe(Command.GET_USER_INFO)
      expect(api.callId).toHaveLength(36)
    }
  })

  it('sunucu tarafı token süresi dolumunu EArsivAuthError olarak yükseltir ve token temizler (I7)', async () => {
    const fetchMock = vi.fn(() =>
      json({ error: '1', messages: [{ type: '7', text: 'Bu işlem için yetkiniz yok' }] }),
    )
    const clearToken = vi.fn()
    const gateway = gatewayWith(fetchMock as unknown as typeof globalThis.fetch, 'tok', clearToken)

    try {
      await gateway.call(Command.GET_USER_INFO, PageName.USER, {})
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect(error).toBeInstanceOf(EArsivAuthError)
      const auth = error as EArsivAuthError
      expect(auth.cause).toBeInstanceOf(EArsivApiError)
      expect((auth.cause as EArsivApiError).command).toBe(Command.GET_USER_INFO)
    }
    expect(clearToken).toHaveBeenCalledTimes(1)
  })

  it('data alanını tipli olarak döndürür', async () => {
    const fetchMock = vi.fn(() => json({ data: [{ ettn: 'a' }] }))
    const result = await gatewayWith(fetchMock as unknown as typeof globalThis.fetch).call<
      { ettn: string }[]
    >(Command.LIST_INVOICES, PageName.INTERACTIVE_DRAFTS, {})
    expect(result[0]?.ettn).toBe('a')
  })
})

describe('DispatchGateway.call — RETRYABLE_COMMANDS (C1)', () => {
  const gatewayWithRetry = (fetchImpl: typeof globalThis.fetch): DispatchGateway => {
    const options = resolveClientOptions({
      environment: 'test',
      fetch: fetchImpl,
      retry: { attempts: 3, backoffMs: 0 },
    })
    return new DispatchGateway(new HttpClient(options), {
      getToken: () => 'tok',
      clearToken: () => undefined,
    })
  }

  it('mutasyon niteliğindeki bir komut 503 karşısında TEK POST atar (mükerrer fatura koruması)', async () => {
    const fetchMock = vi.fn(() => new Response('bozuk', { status: 503 }))
    const gateway = gatewayWithRetry(fetchMock as unknown as typeof globalThis.fetch)

    await expect(gateway.call(Command.CREATE_INVOICE, PageName.INVOICE_FORM, {})).rejects.toThrow(
      EArsivNetworkError,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('salt okunur bir komut 503 karşısında yapılandırılan sayıya kadar dener', async () => {
    const fetchMock = vi.fn(() => new Response('bozuk', { status: 503 }))
    const gateway = gatewayWithRetry(fetchMock as unknown as typeof globalThis.fetch)

    await expect(
      gateway.call(Command.LIST_INVOICES, PageName.INTERACTIVE_DRAFTS, {}),
    ).rejects.toThrow(EArsivNetworkError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
