import { describe, expect, it, vi } from 'vitest'

import { resolveClientOptions } from '../../config/index.js'
import { EArsivApiError, EArsivAuthError } from '../../core/index.js'
import { HttpClient } from '../../transport/index.js'

import { AuthService } from './auth.service.js'

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200 })

const serviceWith = (
  fetchImpl: typeof globalThis.fetch,
  environment: 'test' | 'production' = 'test',
): AuthService => {
  const options = resolveClientOptions({ environment, fetch: fetchImpl })
  return new AuthService(new HttpClient(options), options)
}

const bodyOf = (call: unknown): URLSearchParams =>
  new URLSearchParams((call as [string, RequestInit])[1].body as string)

describe('AuthService.login', () => {
  it('token alır ve saklar', async () => {
    const fetchMock = vi.fn(() => json({ token: 'abc123', chgpwd: 'true' }))
    const service = serviceWith(fetchMock as unknown as typeof globalThis.fetch)

    const token = await service.login({ username: '33333301', password: '1' })

    expect(token).toBe('abc123')
    expect(service.token).toBe('abc123')
    expect(service.isAuthenticated).toBe(true)
    expect(service.getToken()).toBe('abc123')
  })

  it('test ortamında assoscmd=login gönderir', async () => {
    const fetchMock = vi.fn(() => json({ token: 't' }))
    await serviceWith(fetchMock as unknown as typeof globalThis.fetch, 'test').login({
      username: 'u',
      password: 'p',
    })
    const body = bodyOf(fetchMock.mock.calls[0])
    expect(body.get('assoscmd')).toBe('login')
    expect(body.get('userid')).toBe('u')
    expect(body.get('sifre')).toBe('p')
    expect(body.get('sifre2')).toBe('p')
    expect(body.get('parola')).toBe('1')
    expect(body.get('rtype')).toBe('json')
  })

  it('canlı ortamda assoscmd=anologin gönderir', async () => {
    const fetchMock = vi.fn(() => json({ token: 't' }))
    await serviceWith(fetchMock as unknown as typeof globalThis.fetch, 'production').login({
      username: 'u',
      password: 'p',
    })
    expect(bodyOf(fetchMock.mock.calls[0]).get('assoscmd')).toBe('anologin')
  })

  it('loginCommand seçeneği varsayılanı geçersiz kılar', async () => {
    const fetchMock = vi.fn(() => json({ token: 't' }))
    await serviceWith(fetchMock as unknown as typeof globalThis.fetch, 'production').login({
      username: 'u',
      password: 'p',
      loginCommand: 'login',
    })
    expect(bodyOf(fetchMock.mock.calls[0]).get('assoscmd')).toBe('login')
  })

  it('token dönmeyen yanıtta EArsivAuthError fırlatır', async () => {
    const fetchMock = vi.fn(() => json({ chgpwd: 'true' }))
    await expect(
      serviceWith(fetchMock as unknown as typeof globalThis.fetch).login({
        username: 'u',
        password: 'yanlis',
      }),
    ).rejects.toThrow(EArsivAuthError)
  })

  it('portal hatasını EArsivApiError olarak yükseltir', async () => {
    const fetchMock = vi.fn(() =>
      json({ error: '1', messages: [{ text: 'Kullanıcı bulunamadı' }] }),
    )
    await expect(
      serviceWith(fetchMock as unknown as typeof globalThis.fetch).login({
        username: 'yok',
        password: 'x',
      }),
    ).rejects.toThrow(EArsivApiError)
  })
})

describe('AuthService.loginWithTestUser', () => {
  it('test kullanıcısı önerir ve onunla giriş yapar', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/esign') ? json({ userid: '33333312' }) : json({ token: 'tok' }),
    )
    const service = serviceWith(fetchMock as unknown as typeof globalThis.fetch)

    const result = await service.loginWithTestUser()

    expect(result).toEqual({ username: '33333312', password: '1', token: 'tok' })
    expect(bodyOf(fetchMock.mock.calls[0]).get('assoscmd')).toBe('kullaniciOner')
    expect(bodyOf(fetchMock.mock.calls[1]).get('userid')).toBe('33333312')
  })

  it('canlı ortamda çağrılırsa hata fırlatır', async () => {
    const fetchMock = vi.fn(() => json({ userid: '1' }))
    await expect(
      serviceWith(
        fetchMock as unknown as typeof globalThis.fetch,
        'production',
      ).loginWithTestUser(),
    ).rejects.toThrow(EArsivAuthError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('boş userid dönerse hata fırlatır', async () => {
    const fetchMock = vi.fn(() => json({ userid: '' }))
    await expect(
      serviceWith(fetchMock as unknown as typeof globalThis.fetch).loginWithTestUser(),
    ).rejects.toThrow(EArsivAuthError)
  })
})

describe('AuthService token yaşam döngüsü', () => {
  it('token yokken getToken hata fırlatır', () => {
    const service = serviceWith(vi.fn() as unknown as typeof globalThis.fetch)
    expect(service.isAuthenticated).toBe(false)
    expect(service.token).toBeUndefined()
    expect(() => service.getToken()).toThrow(EArsivAuthError)
  })

  it('setToken dışarıdan token kabul eder', () => {
    const service = serviceWith(vi.fn() as unknown as typeof globalThis.fetch)
    service.setToken('kayitli-token')
    expect(service.getToken()).toBe('kayitli-token')
  })

  it('logout token gönderir ve belleği temizler', async () => {
    const fetchMock = vi.fn((url: string) =>
      url.endsWith('/esign') ? json({ userid: 'u' }) : json({ token: 'tok' }),
    )
    const service = serviceWith(fetchMock as unknown as typeof globalThis.fetch)
    await service.loginWithTestUser()

    fetchMock.mockImplementation(() => json({ data: 'çıkış yapıldı' }))
    await service.logout()

    expect(bodyOf(fetchMock.mock.calls.at(-1)).get('assoscmd')).toBe('logout')
    expect(service.isAuthenticated).toBe(false)
  })

  it('token yokken logout sessizce geçer', async () => {
    const fetchMock = vi.fn()
    await serviceWith(fetchMock as unknown as typeof globalThis.fetch).logout()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
