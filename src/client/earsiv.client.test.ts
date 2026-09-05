import { describe, expect, it, vi } from 'vitest'

import { EArsivAuthError } from '../core/index.js'

import { EArsivClient } from './earsiv.client.js'

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

describe('EArsivClient', () => {
  it('varsayılan olarak canlı ortamı seçer', () => {
    expect(new EArsivClient().environment).toBe('production')
  })

  it('test ortamı seçilebilir', () => {
    expect(new EArsivClient({ environment: 'test' }).environment).toBe('test')
  })

  it('oturum açmadan çağrı yapılırsa EArsivAuthError fırlatır', async () => {
    const client = new EArsivClient({ environment: 'test', fetch: vi.fn() as never })
    await expect(client.getUserInfo()).rejects.toThrow(EArsivAuthError)
  })

  it('test kullanıcısıyla giriş yapar ve token açığa çıkar', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/esign') ? json({ userid: '33333399' }) : json({ token: 'tok' }),
    )
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    const result = await client.loginWithTestUser()

    expect(result.username).toBe('33333399')
    expect(client.token).toBe('tok')
    expect(client.isAuthenticated).toBe(true)
  })

  it('setToken ile önceden alınmış token kullanılabilir', async () => {
    const fetchMock = vi.fn(() => json({ data: { vknTckn: '1234567890' } }))
    const client = new EArsivClient({
      environment: 'test',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })

    client.setToken('kayitli')
    await client.getUserInfo()

    const body = new URLSearchParams(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(body.get('token')).toBe('kayitli')
  })

  it('tüm public yöntemleri açığa çıkarır', () => {
    const client = new EArsivClient()
    for (const method of [
      'login',
      'loginWithTestUser',
      'logout',
      'setToken',
      'createDraft',
      'listDrafts',
      'listIncoming',
      'getInvoice',
      'cancelDraft',
      'getInvoiceHtml',
      'downloadPackage',
      'getDownloadUrl',
      'toPdf',
      'getUserInfo',
      'updateUserInfo',
      'getCompanyInfo',
      'sendSmsCode',
      'verifySmsCode',
      'getPhoneNumber',
      'createCancellationRequest',
      'createObjectionRequest',
      'listDisputeRequests',
      'respondToDisputeRequest',
    ]) {
      expect(typeof (client as unknown as Record<string, unknown>)[method]).toBe('function')
    }
  })
})
