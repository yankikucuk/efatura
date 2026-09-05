import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../tests/fixtures/portal-responses.js'
import { DocumentType } from '../constants/index.js'

import { filterByDocumentType, toDocumentSummary } from './document.mapper.js'

describe('toDocumentSummary', () => {
  it('taslak satırını normalize eder ve tarih ayırıcısını düzeltir', () => {
    const rows = portalResponses.draftList.data as unknown as Record<string, unknown>[]
    const summary = toDocumentSummary(rows[0]!)
    expect(summary).toEqual({
      ettn: '3729b07c-f9a4-46f1-ac46-eb88f5ccea84',
      documentNumber: 'GIB2026000000917',
      buyerTaxOrIdentityNumber: '11111111111',
      buyerName: 'NODE PROBE A1B2C3',
      date: '03/09/2026',
      documentType: 'FATURA',
      approvalStatus: 'Onaylanmadı',
    })
  })

  it('ayrıştırılamayan tarihte hata fırlatmaz, ham stringi geri verir (I5)', () => {
    // formatPortalDate('') fırlatır; toDocumentSummary'nin TEK satırı
    // reddetmesi, listenin TAMAMINI bir istisnayla düşürüyordu (bkz. I5).
    const row: Record<string, unknown> = {
      ettn: 'bozuk-satir',
      belgeNumarasi: 'GIB1',
      aliciVknTckn: '11111111111',
      aliciUnvanAdSoyad: 'Bozuk Satır A.Ş.',
      belgeTarihi: '',
      belgeTuru: 'FATURA',
      onayDurumu: 'Onaylanmadı',
    }
    expect(() => toDocumentSummary(row)).not.toThrow()
    expect(toDocumentSummary(row).date).toBe('')
  })

  it('alıcı ünvan alanı olmayan bir satırda (ör. müstahsil makbuzu) buyerName boş string olur', () => {
    // 2026-09-05 canlı doğrulaması: oluşturulan bir müstahsil makbuzu taslak
    // satırında aliciUnvanAdSoyad alanı hiç YOK — yalnızca faturada bulunuyor.
    // resolveCreatedEttn boş buyerName'i ayırt edici saymadığından bu
    // satırın doğru şekilde çözülebilmesi için burada '' üretmesi gerekir.
    const row: Record<string, unknown> = {
      belgeNumarasi: 'GIB2026000000009',
      aliciVknTckn: '11111111111',
      belgeTarihi: '05-09-2026',
      belgeTuru: 'MÜSTAHSİL MAKBUZU',
      onayDurumu: 'Onaylanmadı',
      ettn: '408cc357-0000-0000-0000-000000000000',
    }
    expect(toDocumentSummary(row).buyerName).toBe('')
  })
})

describe('filterByDocumentType', () => {
  // 2026-09-05 canlı doğrulaması: hangiTip 'Buyuk' bir belge türü FİLTRESİ
  // DEĞİL, bir ÜST KÜMEDİR — tek oturumda oluşturulan fatura + iki makbuz
  // aynı listede döndü, hangiTip '5000/30000' ise yalnızca FATURA döndürdü.
  const rows = [
    { ettn: 'f', documentType: DocumentType.INVOICE },
    { ettn: 'm', documentType: DocumentType.PRODUCER_RECEIPT },
    { ettn: 's', documentType: DocumentType.SELF_EMPLOYED_RECEIPT },
  ] as unknown as Parameters<typeof filterByDocumentType>[0]

  it('yalnızca istenen belge türünü bırakır', () => {
    expect(filterByDocumentType(rows, DocumentType.PRODUCER_RECEIPT).map((r) => r.ettn)).toEqual([
      'm',
    ])
    expect(
      filterByDocumentType(rows, DocumentType.SELF_EMPLOYED_RECEIPT).map((r) => r.ettn),
    ).toEqual(['s'])
    expect(filterByDocumentType(rows, DocumentType.INVOICE).map((r) => r.ettn)).toEqual(['f'])
  })

  it('eşleşme yoksa boş liste döner', () => {
    const onlyInvoice = [rows[0]!]
    expect(filterByDocumentType(onlyInvoice, DocumentType.PRODUCER_RECEIPT)).toEqual([])
  })
})
