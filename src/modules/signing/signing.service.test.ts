import { describe, expect, it, vi } from 'vitest'

import type { DispatchGateway } from '../../transport/index.js'
import type { InvoiceSummary } from '../invoice/index.js'

import { SigningService } from './signing.service.js'

const gatewayMock = (call: ReturnType<typeof vi.fn>): DispatchGateway =>
  ({ call }) as unknown as DispatchGateway

const summary: InvoiceSummary = {
  ettn: 'abc-123',
  documentNumber: 'GIB2026000000917',
  buyerTaxOrIdentityNumber: '11111111111',
  buyerName: 'Ali Yılmaz',
  date: '03/09/2026',
  documentType: 'FATURA',
  approvalStatus: 'Onaylanmadı',
}

describe('SigningService.getPhoneNumber', () => {
  it('kayıtlı telefon numarasını döndürür', async () => {
    const call = vi.fn().mockResolvedValue({ telefon: '5551234567' })
    expect(await new SigningService(gatewayMock(call)).getPhoneNumber()).toBe('5551234567')
    expect(call.mock.calls[0]?.[0]).toBe('EARSIV_PORTAL_TELEFONNO_SORGULA')
    expect(call.mock.calls[0]?.[1]).toBe('RG_BASITTASLAKLAR')
  })
})

describe('SigningService.sendSmsCode', () => {
  it('önce numarayı sorgular, sonra kod gönderir', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ telefon: '5551234567' })
      .mockResolvedValueOnce({ oid: 'op-987' })

    const result = await new SigningService(gatewayMock(call)).sendSmsCode()

    expect(result).toEqual({ operationId: 'op-987', phoneNumber: '5551234567' })
    expect(call.mock.calls[1]?.[0]).toBe('EARSIV_PORTAL_SMSSIFRE_GONDER')
    expect(call.mock.calls[1]?.[1]).toBe('RG_SMSONAY')
    expect(call.mock.calls[1]?.[2]).toEqual({
      CEPTEL: '5551234567',
      KCEPTEL: false,
      TIP: '',
    })
  })

  it('numara verilirse sorgulama adımını atlar', async () => {
    const call = vi.fn().mockResolvedValue({ oid: 'op-1' })
    await new SigningService(gatewayMock(call)).sendSmsCode({ phoneNumber: '5559998877' })

    expect(call).toHaveBeenCalledTimes(1)
    expect((call.mock.calls[0]?.[2] as Record<string, unknown>).CEPTEL).toBe('5559998877')
  })

  it('oid dönmezse hata fırlatır', async () => {
    const call = vi.fn().mockResolvedValue({})
    await expect(
      new SigningService(gatewayMock(call)).sendSmsCode({ phoneNumber: '5551112233' }),
    ).rejects.toThrow(/işlem kimliği/i)
  })
})

describe('SigningService.verifySmsCode', () => {
  it('faturaları portal özet biçiminde gönderir', async () => {
    const call = vi.fn().mockResolvedValue({ sonuc: '1' })

    const ok = await new SigningService(gatewayMock(call)).verifySmsCode({
      code: '123456',
      operationId: 'op-987',
      invoices: [summary],
    })

    expect(ok).toBe(true)
    expect(call.mock.calls[0]?.[0]).toBe('0lhozfib5410mp')
    expect(call.mock.calls[0]?.[1]).toBe('RG_SMSONAY')
    expect(call.mock.calls[0]?.[2]).toEqual({
      SIFRE: '123456',
      OID: 'op-987',
      OPR: 1,
      DATA: [
        {
          belgeNumarasi: 'GIB2026000000917',
          aliciVknTckn: '11111111111',
          aliciUnvanAdSoyad: 'Ali Yılmaz',
          belgeTarihi: '03/09/2026',
          belgeTuru: 'FATURA',
          ettn: 'abc-123',
          onayDurumu: 'Onaylanmadı',
        },
      ],
    })
  })

  it('sonuc 0 ise false döner', async () => {
    const call = vi.fn().mockResolvedValue({ sonuc: '0' })
    expect(
      await new SigningService(gatewayMock(call)).verifySmsCode({
        code: '000000',
        operationId: 'op-1',
        invoices: [summary],
      }),
    ).toBe(false)
  })

  it('sonuc alanı yoksa false döner', async () => {
    const call = vi.fn().mockResolvedValue({})
    expect(
      await new SigningService(gatewayMock(call)).verifySmsCode({
        code: '1',
        operationId: 'op-1',
        invoices: [summary],
      }),
    ).toBe(false)
  })

  it('boş fatura listesinde hata fırlatır', async () => {
    const call = vi.fn()
    await expect(
      new SigningService(gatewayMock(call)).verifySmsCode({
        code: '1',
        operationId: 'op-1',
        invoices: [],
      }),
    ).rejects.toThrow(/en az bir fatura/i)
    expect(call).not.toHaveBeenCalled()
  })
})
