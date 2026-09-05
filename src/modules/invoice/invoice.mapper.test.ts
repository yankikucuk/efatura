import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import { Country, Currency, InvoiceType, Unit } from '../../constants/index.js'

import {
  fromPortalPayload,
  num,
  toIncomingExternalSummary,
  toInvoiceSummary,
  toPortalInvoice,
} from './invoice.mapper.js'
import type { InvoiceInput } from './invoice.types.js'

const input = (overrides: Partial<InvoiceInput> = {}): InvoiceInput => ({
  date: '03/09/2026',
  time: '19:30:02',
  buyer: {
    taxOrIdentityNumber: '11111111111',
    firstName: 'Ali',
    lastName: 'Yılmaz',
    taxOffice: 'Maltepe',
    address: { country: Country.TURKIYE, city: 'İstanbul', street: 'Test Sk.' },
  },
  lineItems: [
    { name: 'Yazılım Geliştirme', quantity: 1, unit: Unit.PIECE, unitPrice: 100, vatRate: 20 },
  ],
  ...overrides,
})

describe('toPortalInvoice', () => {
  it('faturaUuid alanını ASLA göndermez', () => {
    const payload = toPortalInvoice(input())
    expect(payload).not.toHaveProperty('faturaUuid')
    expect(payload).not.toHaveProperty('ettn')
  })

  it('temel alanları Türkçe adlara eşler', () => {
    const payload = toPortalInvoice(input())
    expect(payload.faturaTarihi).toBe('03/09/2026')
    expect(payload.saat).toBe('19:30:02')
    expect(payload.paraBirimi).toBe('TRY')
    expect(payload.faturaTipi).toBe('SATIS')
    expect(payload.hangiTip).toBe('5000/30000')
    expect(payload.vknTckn).toBe('11111111111')
    expect(payload.aliciAdi).toBe('Ali')
    expect(payload.aliciSoyadi).toBe('Yılmaz')
    expect(payload.vergiDairesi).toBe('Maltepe')
    expect(payload.ulke).toBe('Türkiye')
    expect(payload.sehir).toBe('İstanbul')
    expect(payload.bulvarcaddesokak).toBe('Test Sk.')
    expect(payload.tip).toBe('İskonto')
  })

  it('kalemleri malHizmetTable olarak eşler', () => {
    const table = toPortalInvoice(input()).malHizmetTable as Record<string, unknown>[]
    expect(table).toHaveLength(1)
    expect(table[0]).toMatchObject({
      malHizmet: 'Yazılım Geliştirme',
      miktar: 1,
      birim: 'C62',
      birimFiyat: '100.00',
      fiyat: '100.00',
      iskontoOrani: 0,
      iskontoTutari: '0.00',
      malHizmetTutari: '100.00',
      kdvOrani: 20,
      kdvTutari: '20.00',
      vergiOrani: 0,
      vergininKdvTutari: '0.00',
      ozelMatrahTutari: '0.00',
    })
  })

  it('toplamları hesaplayıp eşler', () => {
    const payload = toPortalInvoice(input())
    expect(payload.matrah).toBe('100.00')
    expect(payload.malhizmetToplamTutari).toBe('100.00')
    expect(payload.toplamIskonto).toBe('0.00')
    expect(payload.hesaplanankdv).toBe('20.00')
    expect(payload.vergilerToplami).toBe('20.00')
    expect(payload.vergilerDahilToplamTutar).toBe('120.00')
    expect(payload.odenecekTutar).toBe('120.00')
  })

  it('opsiyonel alanları boş string olarak doldurur', () => {
    const payload = toPortalInvoice(input())
    // Yalnızca anahtarın varlığını kontrol etmek yetmez: portal eksik anahtarı
    // da yanlış tipteki değeri de "Form parametrelerinde sorun var" ile
    // reddediyor. Değeri de sabitliyoruz, aksi halde bu test implementasyon
    // null veya 'N/A' doldursa bile geçerdi.
    for (const field of [
      'belgeNumarasi',
      'binaAdi',
      'binaNo',
      'kapiNo',
      'kasabaKoy',
      'mahalleSemtIlce',
      'postaKodu',
      'tel',
      'fax',
      'eposta',
      'websitesi',
      'not',
      'siparisNumarasi',
      'siparisTarihi',
      'irsaliyeNumarasi',
      'irsaliyeTarihi',
      'fisNo',
      'fisTarihi',
      'zRaporNo',
      'okcSeriNo',
    ]) {
      expect(payload[field], `${field} boş string olmalı`).toBe('')
    }
    // Portal bu üç alanda boş string değil tek boşluk bekliyor.
    for (const field of ['vergiCesidi', 'fisSaati', 'fisTipi']) {
      expect(payload[field], `${field} tek boşluk olmalı`).toBe(' ')
    }
    expect(payload.iadeTable).toEqual([])
  })

  it('döviz kurunu string olarak gönderir', () => {
    const payload = toPortalInvoice(input({ currency: Currency.US_DOLLAR, currencyRate: 34.5678 }))
    expect(payload.paraBirimi).toBe('USD')
    expect(payload.dovzTLkur).toBe('34.5678')
  })

  it('fatura tipini geçirir', () => {
    expect(toPortalInvoice(input({ invoiceType: InvoiceType.REFUND })).faturaTipi).toBe('IADE')
  })
})

describe('num (I4 — binlik ayırıcı sağlamlaştırma)', () => {
  it('binlik nokta + ondalık virgülü ayrıştırır', () => {
    expect(num('1.234,56')).toBe(1234.56)
  })

  it('yalnızca ondalık virgülü ayrıştırır', () => {
    expect(num('1234,56')).toBe(1234.56)
  })

  it('yalnızca ondalık noktayı ayrıştırır', () => {
    expect(num('1234.56')).toBe(1234.56)
  })

  it('tam sayı stringi ayrıştırır', () => {
    expect(num('1234')).toBe(1234)
  })

  it('ayrıştırılamayan girdide fallback döner', () => {
    expect(num('abc', 7)).toBe(7)
  })
})

describe('toInvoiceSummary', () => {
  it('taslak satırını normalize eder ve tarih ayırıcısını düzeltir', () => {
    const rows = portalResponses.draftList.data as unknown as Record<string, unknown>[]
    const summary = toInvoiceSummary(rows[0]!)
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
    // formatPortalDate('') fırlatır; toInvoiceSummary'nin TEK satırı
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
    expect(() => toInvoiceSummary(row)).not.toThrow()
    expect(toInvoiceSummary(row).date).toBe('')
  })
})

describe('toIncomingExternalSummary', () => {
  it('entegratör satırını satıcı kimliğiyle eşler (portal alıcı kimliğinden FARKLI alanlar)', () => {
    // Bu test yalnızca alan SAYISINI değil, satıcı-özel alanların (seller*,
    // invoiceNumber) doğru anahtarlardan okunduğunu doğrular — aksi halde bu
    // satırları yanlışlıkla toInvoiceSummary'den geçirmek (alıcı alanlarını
    // arayıp bulamadığı için) sessizce boş satıcı kimliği üretirdi.
    const row: Record<string, unknown> = {
      ettn: 'ettn-1',
      belgeNumarasi: 'GIB2026000000123',
      faturaNo: 'ENT-2026-000042',
      saticiVknTckn: '9999999999',
      saticiUnvanAdSoyad: 'Entegratör Satıcı A.Ş.',
      belgeTarihi: '03-09-2026',
      belgeTuru: 'FATURA',
      onayDurumu: 'Onaylandı',
    }

    expect(toIncomingExternalSummary(row)).toEqual({
      ettn: 'ettn-1',
      documentNumber: 'GIB2026000000123',
      invoiceNumber: 'ENT-2026-000042',
      sellerTaxOrIdentityNumber: '9999999999',
      sellerName: 'Entegratör Satıcı A.Ş.',
      date: '03/09/2026',
      documentType: 'FATURA',
      approvalStatus: 'Onaylandı',
    })
  })

  it('ayrıştırılamayan tarihte hata fırlatmaz (I5 ile aynı sağlamlaştırma)', () => {
    const row: Record<string, unknown> = {
      ettn: 'ettn-2',
      belgeNumarasi: 'GIB1',
      faturaNo: '',
      saticiVknTckn: '9999999999',
      saticiUnvanAdSoyad: 'X',
      belgeTarihi: '',
      belgeTuru: 'FATURA',
      onayDurumu: 'Onaylanmadı',
    }
    expect(() => toIncomingExternalSummary(row)).not.toThrow()
    expect(toIncomingExternalSummary(row).date).toBe('')
  })
})

describe('fromPortalPayload', () => {
  it('Türkçe alan adlarıyla verilen ham nesneyi InvoiceInput yapar', () => {
    const result = fromPortalPayload({
      faturaTarihi: '03/09/2026',
      saat: '19:30:02',
      paraBirimi: 'TRY',
      faturaTipi: 'SATIS',
      vknTckn: '11111111111',
      aliciAdi: 'Ali',
      aliciSoyadi: 'Yılmaz',
      ulke: 'Türkiye',
      sehir: 'İstanbul',
      not: 'açıklama',
      malHizmetTable: [
        {
          malHizmet: 'Danışmanlık',
          miktar: 2,
          birim: 'DAY',
          birimFiyat: '250',
          kdvOrani: 20,
          iskontoOrani: 10,
        },
      ],
    })

    expect(result.buyer.taxOrIdentityNumber).toBe('11111111111')
    expect(result.buyer.firstName).toBe('Ali')
    expect(result.buyer.address?.city).toBe('İstanbul')
    expect(result.note).toBe('açıklama')
    expect(result.lineItems[0]).toMatchObject({
      name: 'Danışmanlık',
      quantity: 2,
      unit: 'DAY',
      unitPrice: 250,
      vatRate: 20,
      discountRate: 10,
    })
  })

  it('gidiş-dönüş temel alanları korur', () => {
    const portal = toPortalInvoice(input())
    const back = fromPortalPayload(portal)
    expect(back.buyer.taxOrIdentityNumber).toBe('11111111111')
    expect(back.lineItems[0]?.name).toBe('Yazılım Geliştirme')
    expect(back.lineItems[0]?.unitPrice).toBe(100)
    expect(back.lineItems[0]?.vatRate).toBe(20)
  })
})
