/**
 * Canlı test portalına (`earsivportaltest.efatura.gov.tr`) karşı uçtan uca
 * paket.
 *
 * Varsayılan olarak KAPALIDIR (`EFATURA_E2E=1` ile açılır): devlet sunucusuna
 * her `npm test` çalıştırmasında yük bindirmemek için. Birim testleri
 * fixture'lara karşı çalışır ve fixture'lar eskiyebilir — portalın habersiz
 * değiştiğini yalnızca bu paket görebilir.
 *
 * İki yapısal kural:
 * - Hiçbir test SAYIM iddiası içermez ("listede tam olarak N kayıt var").
 *   `kullaniciOner` her çağrıda "yeni" bir test kullanıcısı verir ama havuz
 *   DÖNÜŞÜMLÜDÜR: tahsis edilen kullanıcı önceki çalıştırmalardan kalma
 *   belgeler taşıyabiliyor (canlı gözlem: 33333307 numaralı kullanıcı iki eski
 *   müstahsil makbuzuyla geldi). Sayım iddiası rastgele kırılırdı.
 * - Alıcı ünvanına rastgele bir damga (`uniqueStamp`) eklenir; test
 *   kullanıcıları portalı kullanan herkesle paylaşıldığı için kendi
 *   kayıtlarımızı ancak böyle güvenilir biçimde ayırt edebiliriz.
 *
 * KANARYA testi ters yönde çalışan tek testtir: portalın SMM gösterim kusurunu,
 * kendi korumamızı ATLAYARAK, genel fatura gösterim yolundan doğrudan
 * yokluyor. GİB kusuru düzeltirse bu test KIRILIR — ve o an
 * `getSelfEmployedReceiptHtml`/`selfEmployedReceiptToPdf` kısıtının
 * kaldırılması gerektiği anlaşılır. Bugün hâlâ bozuk (canlı teyit 2026-09-05).
 *
 * KAPSAM DIŞI — taslak SİLME. `EARSIV_PORTAL_FATURA_SIL` test portalında
 * HİÇBİR belge türünde çalışmıyor ("Silinirken bir sorun oluştu."), fatura
 * dahil; denenen tüm yük ve `pageName` varyantlarıyla doğrulandı. Yani bu bir
 * makbuz gerilemesi değil, önceden var olan bir portal davranışıdır ve üretim
 * ortamında denemek gerçek hukuki belge oluşturmayı gerektirdiği için
 * kapsanmıyor.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { EArsivClient, EArsivPortalDefectError, InvoiceListKind, Unit } from '../../src/index.js'
import { isE2eEnabled, uniqueStamp } from '../helpers/e2e-guard.js'

// Devlet sunucusuna gereksiz yük bindirmemek için varsayılan olarak kapalı.
describe.runIf(isE2eEnabled())('e-Arşiv test portalı uçtan uca', () => {
  // Kapsam: tek oturumda gerçek bir fatura + iki makbuz oluşturup geri okuma,
  // liste/gösterim/indirme yollarının canlıda çalıştığı ve SMM gösterim
  // kusurunun HÂLÂ mevcut olduğu. Silme kapsam dışıdır (bkz. dosya başlığı).
  const client = new EArsivClient({ environment: 'test', timeoutMs: 45_000 })
  const buyerTitle = uniqueStamp()
  let ettn = ''
  let producerReceiptEttn = ''
  let selfEmployedReceiptEttn = ''

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

  // — Makbuz belgeleri —
  //
  // DİKKAT: `kullaniciOner` her çağrıda YENİ bir test kullanıcısı tahsis
  // eder ama havuz DÖNÜŞÜMLÜDÜR: tahsis edilen kullanıcı önceki
  // çalıştırmalardan kalan makbuzlar taşıyabilir (canlı gözlem 2026-09-05).
  // Bu yüzden hiçbir test "listede tam olarak N kayıt var" demiyor; ETTN
  // çözümü zaten anlık görüntü FARKINA dayandığı için bundan etkilenmez.

  it('müstahsil makbuzu oluşturur ve ETTN çözer', async () => {
    const created = await client.createProducerReceipt({
      producer: {
        taxOrIdentityNumber: '11111111111',
        firstName: 'E2E',
        lastName: buyerTitle,
      },
      city: 'İstanbul',
      website: 'https://ornek.test',
      note: 'E2E müstahsil notu',
      lineItems: [
        {
          name: 'Ceviz',
          quantity: 10,
          unit: Unit.KILOGRAM,
          unitPrice: 100,
          taxRates: {
            incomeTaxWithholding: 2,
            pastureFund: 1,
            stockExchangeRegistration: 0.5,
            socialSecurityPremium: 1,
          },
        },
      ],
    })

    expect(created.ettn).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(created.documentNumber).toMatch(/^GIB/)
    producerReceiptEttn = created.ettn
  }, 120_000)

  it('müstahsil makbuzunu geri okur ve gidiş-dönüş alanlarını doğrular', async () => {
    const detail = await client.getProducerReceipt(producerReceiptEttn)

    expect(detail.ettn).toBe(producerReceiptEttn)
    expect(detail.producer.taxOrIdentityNumber).toBe('11111111111')
    expect(detail.website).toBe('https://ornek.test')
    // Portal `not` alanının sonuna bir satır sonu ekliyor; mapper kırpıyor.
    expect(detail.note).toBe('E2E müstahsil notu')
    // teslimTarih verilmedi; belge tarihine düşmeli.
    expect(detail.deliveryDate).toBe(detail.date)
    // Dört kesintinin dördü de geri okunabiliyor.
    expect(detail.totals.taxAmounts).toEqual({
      incomeTaxWithholding: 20,
      pastureFund: 10,
      stockExchangeRegistration: 5,
      socialSecurityPremium: 10,
    })
    expect(detail.totals.payableAmount).toBe(955)
  })

  it('serbest meslek makbuzu oluşturur ve ETTN çözer', async () => {
    const created = await client.createSelfEmployedReceipt({
      payer: {
        taxOrIdentityNumber: '11111111111',
        firstName: 'E2E',
        lastName: buyerTitle,
        taxOffice: 'Maltepe',
        address: { city: 'İstanbul', street: 'Test Sk.' },
      },
      description: 'E2E serbest meslek makbuzu',
      lineItems: [
        {
          description: 'Danışmanlık',
          grossFee: 1000,
          vatRate: 20,
          withholdingRate: 20,
          vatWithholdingRate: 50,
        },
      ],
    })

    expect(created.ettn).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    selfEmployedReceiptEttn = created.ettn
  }, 120_000)

  it('serbest meslek makbuzunu geri okur ve zinciri doğrular', async () => {
    const detail = await client.getSelfEmployedReceipt(selfEmployedReceiptEttn)

    expect(detail.ettn).toBe(selfEmployedReceiptEttn)
    expect(detail.description).toBe('E2E serbest meslek makbuzu')
    expect(detail.totals).toEqual({
      grossFee: 1000,
      withholding: 200,
      netFee: 800,
      vat: 200,
      vatWithholding: 100,
      collectedVat: 100,
      netReceived: 900,
    })
    // Portal kalem düzeyinde stopaj/KDV TUTARLARINI döndürmüyor; oranlardan
    // yeniden hesaplanıyorlar.
    expect(detail.lineItems[0]?.vatAmount).toBe(200)
    expect(detail.lineItems[0]?.netReceived).toBe(900)
  })

  it("hangiTip 'Buyuk' listesi ÜST KÜMEDİR ve belge türüne göre süzülür", async () => {
    const [producers, selfEmployed, allDrafts] = await Promise.all([
      client.listProducerReceipts(new Date(), new Date()),
      client.listSelfEmployedReceipts(new Date(), new Date()),
      client.listDrafts(new Date(), new Date(), { kind: InvoiceListKind.STANDARD }),
    ])

    expect(producers.some((row) => row.ettn === producerReceiptEttn)).toBe(true)
    expect(selfEmployed.some((row) => row.ettn === selfEmployedReceiptEttn)).toBe(true)
    // Süzme gerçekten çalışıyor: her liste yalnızca kendi türünü içeriyor.
    expect(producers.some((row) => row.ettn === selfEmployedReceiptEttn)).toBe(false)
    expect(selfEmployed.some((row) => row.ettn === producerReceiptEttn)).toBe(false)
    // Süzülmemiş liste ÜÇÜNÜ birden içeriyor — bu testin bütün gerekçesi.
    for (const id of [ettn, producerReceiptEttn, selfEmployedReceiptEttn]) {
      expect(allDrafts.some((row) => row.ettn === id)).toBe(true)
    }
  })

  it('müstahsil makbuzunun HTML gösterimini döndürür', async () => {
    const html = await client.getProducerReceiptHtml(producerReceiptEttn)
    expect(html.length).toBeGreaterThan(1_000)
    expect(html.toLowerCase()).toContain('<html')
  })

  it('SMM HTML gösterimi kendi tarafımızda net bir hatayla reddedilir', () => {
    expect(() => client.getSelfEmployedReceiptHtml(selfEmployedReceiptEttn)).toThrow(
      EArsivPortalDefectError,
    )
  })

  it('KANARYA: SMM gösterimi portalda HÂLÂ bozuk ve ham istisna sızmıyor', async () => {
    // Bu test portalın kusurunu DOĞRUDAN yokluyor (SMM korumasını atlayarak,
    // genel fatura gösterim yolundan). İki şeyi birden sabitliyor:
    // 1. Kusur hâlâ var. GİB düzeltirse test KIRILIR ve o an
    //    getSelfEmployedReceiptHtml/toPdf kısıtı kaldırılmalıdır.
    // 2. Kullanıcı ham Java istisnasını görmüyor; çeviri devrede.
    let thrown: unknown
    try {
      await client.getInvoiceHtml(selfEmployedReceiptEttn)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(EArsivPortalDefectError)
    expect((thrown as EArsivPortalDefectError).portalMessage).toMatch(/String index out of range/)
  })

  it('oturumu kapatır', async () => {
    await client.logout()
    expect(client.isAuthenticated).toBe(false)
  })
})
