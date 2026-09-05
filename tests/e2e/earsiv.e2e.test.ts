import { beforeAll, describe, expect, it } from 'vitest'

import { EArsivClient, InvoiceListKind, Unit } from '../../src/index.js'
import { isE2eEnabled, uniqueStamp } from '../helpers/e2e-guard.js'

// Devlet sunucusuna gereksiz yük bindirmemek için varsayılan olarak kapalı.
describe.runIf(isE2eEnabled())('e-Arşiv test portalı uçtan uca', () => {
  const client = new EArsivClient({ environment: 'test', timeoutMs: 45_000 })
  const buyerTitle = uniqueStamp()
  let ettn = ''

  beforeAll(async () => {
    const credentials = await client.loginWithTestUser()
    expect(credentials.username).toMatch(/^\d+$/)
    expect(client.isAuthenticated).toBe(true)
  }, 60_000)

  it('firma bilgilerini okur', async () => {
    const info = await client.getUserInfo()
    expect(info.taxOrIdentityNumber).toMatch(/^\d{10,11}$/)
  })

  it('fatura oluşturur ve ETTN çözer', async () => {
    const created = await client.createDraft({
      buyer: {
        taxOrIdentityNumber: '11111111111',
        title: buyerTitle,
        address: { city: 'İstanbul', street: 'Test Sk.' },
      },
      lineItems: [
        {
          name: 'Yazılım Geliştirme',
          quantity: 1,
          unit: Unit.PIECE,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      note: 'E2E testi',
    })

    expect(created.ettn).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(created.documentNumber).toMatch(/^GIB/)
    ettn = created.ettn
  }, 120_000)

  it('oluşturulan faturayı geri okur', async () => {
    const detail = await client.getInvoice(ettn)
    expect(detail.ettn).toBe(ettn)
    expect(detail.buyer.taxOrIdentityNumber).toBe('11111111111')
  })

  it('taslak listesinde görünür', async () => {
    const drafts = await client.listDrafts(new Date(), new Date(), {
      kind: InvoiceListKind.INTERACTIVE,
    })
    expect(drafts.some((row) => row.ettn === ettn)).toBe(true)
  })

  it('HTML gösterimini döndürür', async () => {
    const html = await client.getInvoiceHtml(ettn)
    expect(html.length).toBeGreaterThan(1_000)
    expect(html.toLowerCase()).toContain('<html')
  })

  it('belge paketini ZIP olarak indirir', async () => {
    const zip = await client.downloadPackage(ettn)
    // ZIP dosya imzası: PK\x03\x04
    expect(Array.from(zip.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(zip.byteLength).toBeGreaterThan(1_000)
  }, 60_000)

  it('gelen iptal/itiraz taleplerini listeler', async () => {
    const requests = await client.listDisputeRequests(new Date(), new Date())
    expect(Array.isArray(requests)).toBe(true)
  })

  it('oturumu kapatır', async () => {
    await client.logout()
    expect(client.isAuthenticated).toBe(false)
  })
})
