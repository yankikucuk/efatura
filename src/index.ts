/**
 * `efatura` — GİB e-Arşiv Portalı için sıfır bağımlılıklı TypeScript
 * istemcisi.
 *
 * Paket kökü tüm public yüzeyi tek bir yerden dışa açar: `EArsivClient`
 * facade'ı, modül servisleri (tek başına da kurulabilir), taşıma katmanı,
 * portal sabitleri, para/tarih yardımcıları ve hata sınıfları.
 *
 * Tipik kullanım tek bir sınıfla başlar:
 *
 * @example
 * ```ts
 * import { EArsivClient, Unit } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 * await client.loginWithTestUser()
 *
 * const created = await client.createDraft({
 *   buyer: { taxOrIdentityNumber: '11111111111', title: 'ÖRNEK A.Ş.' },
 *   lineItems: [{ name: 'Hizmet', quantity: 1, unit: Unit.PIECE, unitPrice: 250, vatRate: 20 }],
 * })
 * console.log(created.ettn)
 *
 * await client.logout()
 * ```
 *
 * @remarks
 * Bilinmesi gereken portal gerçekleri:
 *
 * - Belge oluşturma ÜÇ portal isteği yapar (listele → oluştur → yeniden
 *   listele); portal ETTN döndürmediği için kimlik anlık görüntü farkıyla
 *   çözülür ve fark tekile inmezse `EArsivAmbiguousResultError` fırlatılır.
 * - `InvoiceListKind.STANDARD` (`'Buyuk'`) bir belge türü filtresi DEĞİL, bir
 *   ÜST KÜMEDİR: fatura ve her iki makbuz türü aynı listede döner.
 * - Serbest Meslek Makbuzunun HTML gösterimi portalda BOZUKTUR;
 *   `getSelfEmployedReceiptHtml` ağa hiç çıkmadan
 *   `EArsivPortalDefectError` fırlatır. Basılabilir RESMİ belge yine de
 *   erişilebilir: `downloadSelfEmployedReceiptPdf` portalın kendi PDF'ini
 *   indirir.
 * - Belge indirme sorgusundaki `belgeTip` belge TÜRÜNÜ taşır ve dönen format
 *   da türe göre değişir: fatura ve müstahsil ZIP, serbest meslek makbuzu
 *   doğrudan PDF. Yanlış tür SESSİZCE boş yanıt üretir.
 * - Taslak silme (`cancelDraft`) test portalında hiçbir belge türünde
 *   çalışmıyor; bu portalın önceden var olan davranışıdır.
 * - Portal makbuz tutarlarını ne hesaplar ne doğrular — aritmetik güvencesi
 *   tamamen bu kütüphanededir.
 * - `retry.attempts` YALNIZCA salt okunur komutları etkiler; mutasyonlar her
 *   koşulda tek kez denenir.
 *
 * @packageDocumentation
 */

export * from './client/index.js'
export * from './config/index.js'
export * from './constants/index.js'
export * from './core/index.js'
export * from './modules/index.js'
export * from './pdf/index.js'
// Spec §8: her servis (InvoiceService, DocumentService, ...) tek başına
// `new`'lenebilir olmalı. Bunun için constructor parametre tipleri
// (DispatchGateway, HttpClient, TokenProvider, Endpoint) da dışa açık
// olmalı — modules/index.js'i export etmek yetmez, transport hiç
// export edilmiyordu (bkz. I9).
export * from './transport/index.js'
