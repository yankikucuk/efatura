/**
 * Serbest meslek makbuzunun portal yüküne ve portal yanıtından tipli detaya
 * çevrilmesi.
 *
 * Okuma yolunda ASİMETRİK bir kural geçerlidir ve bu dosyanın özü odur:
 *
 * - KALEM tutarları oranlardan YENİDEN HESAPLANIR. Portal kalem düzeyinde
 *   türetilmiş tutarları (`gvStopajTutari`, `kdvTutari`, `kdvTevkifatTutari`)
 *   hiç döndürmüyor; döndürdüğü `netUcret`/`netAlinan` ise portalın hesabı
 *   değil, bizim gönderdiğimizin yankısıdır — gönderilmezse 0 olarak SAKLANIYOR
 *   (canlı doğrulandı). Saklanan değeri olduğu gibi raporlamak, 500 ₺ brüt
 *   ücretli bir makbuzu "net alınan: 0" diye göstermek olurdu.
 * - BELGE toplamları ise portalın kendi kaydından OKUNUR (faturadaki I4
 *   kararı): resmi rakam GİB'in tuttuğudur.
 *
 * Belge toplamı testi ayırt edici olsun diye kalemlerden çıkacak değerden
 * BİLEREK saptırılmıştır ve bu sapma gerçekçidir: portal gönderilen toplamı
 * doğrulamadan sakladığı için kayıtlı rakam kalemlerle çelişebilir.
 *
 * İki alan adı tuzağı da burada kilitlidir: adres alanı SMM'de
 * `bulvarCaddeSokak` (büyük harfli), faturada `bulvarcaddesokak` (tamamı
 * küçük); ve referans PHP kütüphanesinin gönderdiği `xxx` alanı GEREKSİZDİR,
 * gönderilmez (canlı doğrulandı: onsuz oluşturma başarılı).
 */

import { describe, expect, it } from 'vitest'

import { portalResponses } from '../../../tests/fixtures/portal-responses.js'
import { Country, Currency } from '../../constants/index.js'

import {
  toPortalSelfEmployedReceipt,
  toSelfEmployedReceiptDetail,
} from './self-employed-receipt.mapper.js'
import type { SelfEmployedReceiptInput } from './self-employed-receipt.types.js'

const input = (overrides: Partial<SelfEmployedReceiptInput> = {}): SelfEmployedReceiptInput => ({
  date: '05/09/2026',
  time: '19:38:52',
  payer: {
    taxOrIdentityNumber: '11111111111',
    firstName: 'PROBE',
    lastName: 'SERBEST',
    taxOffice: 'Maltepe',
    address: { country: Country.TURKIYE, city: 'İstanbul', street: 'Test Sk.' },
  },
  description: 'SMM notu',
  lineItems: [
    {
      description: 'Danışmanlık',
      grossFee: 1000,
      vatRate: 20,
      withholdingRate: 20,
      vatWithholdingRate: 50,
    },
  ],
  ...overrides,
})

describe('toPortalSelfEmployedReceipt', () => {
  // Kapsam: yazma yönü — kısaltılmış toplam alan adları (`brtUcret`,
  // `gvStpjTtari`, ...), TÜRETİLMİŞ kalem tutarlarının gönderilmesi (portal
  // hesaplamıyor), boolean `kdvTahakkukIcin` ve gönderilmeyen alanlar.
  it('kimlik alanlarını ASLA göndermez', () => {
    const payload = toPortalSelfEmployedReceipt(input())
    expect(payload).not.toHaveProperty('ettn')
    expect(payload).not.toHaveProperty('uuid')
  })

  it('referans PHP kütüphanesindeki `xxx` alanını GÖNDERMEZ', () => {
    // Canlı doğrulandı: alan olmadan oluşturma başarılı. Referans kütüphane
    // bunu gönderiyor; facts dosyası açıkça "gereksiz" diyor.
    expect(toPortalSelfEmployedReceipt(input())).not.toHaveProperty('xxx')
  })

  it('gövde alanlarını portalın Türkçe adlarına eşler', () => {
    const payload = toPortalSelfEmployedReceipt(input())
    expect(payload.vknTckn).toBe('11111111111')
    expect(payload.adi).toBe('PROBE')
    expect(payload.soyadi).toBe('SERBEST')
    expect(payload.unvan).toBe('')
    expect(payload.vergiDairesi).toBe('Maltepe')
    expect(payload.tarih).toBe('05/09/2026')
    expect(payload.saat).toBe('19:38:52')
    expect(payload.paraBirimi).toBe('TRY')
    expect(payload.aciklama).toBe('SMM notu')
    // Adres alanı adı FATURADAKİNDEN FARKLI yazılıyor: burada büyük harfli
    // `bulvarCaddeSokak`, faturada tamamı küçük `bulvarcaddesokak`.
    expect(payload.bulvarCaddeSokak).toBe('Test Sk.')
    expect(payload).not.toHaveProperty('bulvarcaddesokak')
    expect(payload.sehir).toBe('İstanbul')
    expect(payload.ulke).toBe('Türkiye')
  })

  it('kdvTahakkukIcin BOOLEAN gönderilir ve varsayılanı false olur', () => {
    // Canlı doğrulandı: alan detay yanıtında boolean olarak dönüyor.
    expect(toPortalSelfEmployedReceipt(input()).kdvTahakkukIcin).toBe(false)
    expect(toPortalSelfEmployedReceipt(input({ forVatAccrual: true })).kdvTahakkukIcin).toBe(true)
  })

  it('kalemi serbestTable içinde TÜRETİLMİŞ tutarlarla birlikte gönderir', () => {
    // Portal bu alanları HESAPLAMIYOR, gönderileni saklıyor (canlı
    // doğrulandı: netUcret gönderilmeyince 0 olarak kaydedildi). Bu yüzden
    // türetilmiş değerleri göndermek zorunludur.
    const table = toPortalSelfEmployedReceipt(input()).serbestTable as Record<string, unknown>[]
    expect(table[0]).toEqual({
      neIcinAlindigi: 'Danışmanlık',
      brutUcret: '1000.00',
      kdv: 20,
      stopaj: 20,
      netUcret: '800.00',
      kdvTevkifatOrani: 50,
      netAlinan: '900.00',
    })
  })

  it('yedi belge toplamını portalın kısaltılmış alan adlarına eşler', () => {
    const payload = toPortalSelfEmployedReceipt(input())
    expect(payload.brtUcret).toBe('1000.00')
    expect(payload.gvStpjTtari).toBe('200.00')
    expect(payload.netUcretTtr).toBe('800.00')
    expect(payload.kdvTtri).toBe('200.00')
    expect(payload.kdvTvkftTtri).toBe('100.00')
    expect(payload.thsilEdilenKdv).toBe('100.00')
    expect(payload.netAlinanToplam).toBe('900.00')
  })

  it('döviz kurunu string olarak gönderir', () => {
    const payload = toPortalSelfEmployedReceipt(
      input({ currency: Currency.US_DOLLAR, currencyRate: 34.5678 }),
    )
    expect(payload.paraBirimi).toBe('USD')
    expect(payload.kur).toBe('34.5678')
  })

  it('opsiyonel alanları boş string olarak doldurur', () => {
    const payload = toPortalSelfEmployedReceipt(
      input({ payer: { taxOrIdentityNumber: '1234567890', title: 'ACME A.Ş.' } }),
    )
    for (const field of [
      'belgeNumarasi',
      'adi',
      'soyadi',
      'bulvarCaddeSokak',
      'binaAdi',
      'binaNo',
      'kapiNo',
      'kasabaKoy',
      'mahalleSemtIlce',
      'sehir',
      'postaKodu',
      'vergiDairesi',
    ]) {
      expect(payload[field], `${field} boş string olmalı`).toBe('')
    }
    expect(payload.unvan).toBe('ACME A.Ş.')
  })
})

describe('toSelfEmployedReceiptDetail', () => {
  // Kapsam: okuma yönü ve buradaki ASİMETRİ — kalem tutarları oranlardan
  // yeniden hesaplanır, belge toplamları portaldan okunur.
  const raw = portalResponses.selfEmployedReceiptDetail.data as unknown as Record<string, unknown>

  it('kimlik alanı `ettn`dir (müstahsilde `uuid`)', () => {
    expect(toSelfEmployedReceiptDetail(raw, 'yedek').ettn).toBe(
      '7ae53b5f-d5a5-489b-9ba1-fe5801a8a209',
    )
    expect(toSelfEmployedReceiptDetail({ ...raw, ettn: undefined }, 'yedek').ettn).toBe('yedek')
  })

  it('alıcı ve adres alanlarını geri okur', () => {
    const detail = toSelfEmployedReceiptDetail(raw, 'x')
    expect(detail.documentNumber).toBe('GIB2026000000245')
    expect(detail.date).toBe('05/09/2026')
    expect(detail.payer.taxOrIdentityNumber).toBe('11111111111')
    expect(detail.payer.firstName).toBe('PROBE')
    expect(detail.payer.taxOffice).toBe('Maltepe')
    expect(detail.payer.address?.street).toBe('Test Sk.')
    expect(detail.payer.address?.city).toBe('İstanbul')
    expect(detail.description).toBe('SMM notu')
    expect(detail.forVatAccrual).toBe(false)
    expect(detail.currency).toBe('TRY')
  })

  it('portalın DÖNDÜRMEDİĞİ kalem tutarlarını oranlardan yeniden hesaplar', () => {
    // Canlı doğrulama: kalem yanıtında `gvStopajTutari`, `kdvTutari` ve
    // `kdvTevkifatTutari` HİÇ YOK — yalnızca oranlar geliyor.
    const rawLine = (raw.serbestTable as Record<string, unknown>[])[0]
    expect(Object.keys(rawLine ?? {})).not.toContain('kdvTutari')
    expect(Object.keys(rawLine ?? {})).not.toContain('gvStopajTutari')

    const [line] = toSelfEmployedReceiptDetail(raw, 'x').lineItems
    expect(line).toMatchObject({
      description: 'Danışmanlık',
      grossFee: 1000,
      vatRate: 20,
      withholdingRate: 20,
      vatWithholdingRate: 50,
      withholdingAmount: 200,
      netFee: 800,
      vatAmount: 200,
      vatWithholdingAmount: 100,
      collectedVat: 100,
      netReceived: 900,
    })
  })

  it('kalem türetimlerini portalın SAKLADIĞI değere değil orana dayandırır', () => {
    // Canlı kanıt: `netUcret`/`netAlinan` gönderilmediğinde portal bunları
    // hesaplamayıp 0 olarak SAKLIYOR. Saklanan değeri olduğu gibi raporlamak,
    // 500 ₺ brüt ücretli bir makbuzu "net alınan: 0" diye göstermek olurdu.
    const stored = portalResponses.selfEmployedReceiptDetailMissingLineDerivations
      .data as unknown as Record<string, unknown>
    expect((stored.serbestTable as Record<string, unknown>[])[0]?.netAlinan).toBe(0)

    const [line] = toSelfEmployedReceiptDetail(stored, 'x').lineItems
    expect(line?.netFee).toBe(400)
    expect(line?.netReceived).toBe(500)
  })

  it('BELGE toplamlarını portalın kendi kaydından okur, kalemlerden türetmez', () => {
    // Ayırt edici olmak için belge toplamı kalemlerden çıkacak değerden
    // BİLEREK saptırıldı. Bu sapma gerçekçidir: müstahsil tarafında canlı
    // olarak kanıtlandığı gibi portal gönderilen toplamı doğrulamadan
    // saklıyor, yani kayıtlı rakam kalemlerle çelişebilir. Resmi rakam
    // GİB'in tuttuğudur; kütüphane kendi aritmetiğini onun yerine koymamalı
    // (faturadaki I4 kararı).
    const stored = {
      ...(portalResponses.selfEmployedReceiptDetailMissingLineDerivations.data as unknown as Record<
        string,
        unknown
      >),
      netAlinanToplam: 777.77,
      kdvTtri: 123.45,
    }
    const totals = toSelfEmployedReceiptDetail(stored, 'x').totals
    expect(totals.netReceived).toBe(777.77)
    expect(totals.vat).toBe(123.45)
    expect(totals.grossFee).toBe(500)
  })

  it('bozuk tarih alanında FIRLATMAZ', () => {
    expect(toSelfEmployedReceiptDetail({ ...raw, tarih: '' }, 'x').date).toBe('')
  })
})
