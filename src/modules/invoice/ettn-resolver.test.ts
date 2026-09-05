import { describe, expect, it } from 'vitest'

import { EArsivAmbiguousResultError } from '../../core/index.js'

import { resolveCreatedEttn } from './ettn-resolver.js'
import type { InvoiceSummary } from './invoice.types.js'

const summary = (overrides: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  ettn: 'aaaaaaaa-0000-0000-0000-000000000001',
  documentNumber: 'GIB2026000000001',
  buyerTaxOrIdentityNumber: '11111111111',
  buyerName: 'Ali Yılmaz',
  date: '03/09/2026',
  documentType: 'FATURA',
  approvalStatus: 'Onaylanmadı',
  ...overrides,
})

const hint = {
  buyerTaxOrIdentityNumber: '11111111111',
  buyerName: 'Ali Yılmaz',
  date: '03/09/2026',
}

describe('resolveCreatedEttn', () => {
  it('tam olarak bir yeni kayıt varsa onu döndürür', () => {
    const existing = summary({ ettn: 'eski' })
    const created = summary({ ettn: 'yeni' })
    expect(
      resolveCreatedEttn({ before: new Set(['eski']), after: [existing, created], hint }),
    ).toBe(created)
  })

  it('birden fazla yeni kayıtta ipucuyla daraltır', () => {
    const mine = summary({ ettn: 'benim', buyerName: 'Ali Yılmaz' })
    const other = summary({
      ettn: 'baska',
      buyerName: 'Veli Demir',
      buyerTaxOrIdentityNumber: '2222222222',
    })
    expect(resolveCreatedEttn({ before: new Set(), after: [other, mine], hint })).toBe(mine)
  })

  it('daraltma sonrası hâlâ birden fazlaysa hata fırlatır', () => {
    const a = summary({ ettn: 'a' })
    const b = summary({ ettn: 'b' })
    expect(() => resolveCreatedEttn({ before: new Set(), after: [a, b], hint })).toThrow(
      EArsivAmbiguousResultError,
    )
  })

  it('belirsizlik hatası tüm adayları taşır', () => {
    const a = summary({ ettn: 'a' })
    const b = summary({ ettn: 'b' })
    try {
      resolveCreatedEttn({ before: new Set(), after: [a, b], hint })
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      const ambiguous = error as EArsivAmbiguousResultError<InvoiceSummary>
      expect(ambiguous.candidates).toHaveLength(2)
      expect(ambiguous.message).toContain('oluşturuldu')
    }
  })

  it('hiç yeni kayıt yoksa hata fırlatır', () => {
    const existing = summary({ ettn: 'eski' })
    expect(() =>
      resolveCreatedEttn({ before: new Set(['eski']), after: [existing], hint }),
    ).toThrow(EArsivAmbiguousResultError)
  })

  it('boş liste dönerse hata fırlatır', () => {
    expect(() => resolveCreatedEttn({ before: new Set(), after: [], hint })).toThrow(
      EArsivAmbiguousResultError,
    )
  })

  it('alıcı adı boş dönen kayıtlarda VKN ve tarihle eşleşir', () => {
    // Portal TCKN'li alıcılarda aliciUnvanAdSoyad alanını boş bırakabiliyor.
    const mine = summary({ ettn: 'benim', buyerName: '' })
    const other = summary({ ettn: 'baska', buyerTaxOrIdentityNumber: '9999999999', buyerName: '' })
    expect(resolveCreatedEttn({ before: new Set(), after: [other, mine], hint })).toBe(mine)
  })
})
