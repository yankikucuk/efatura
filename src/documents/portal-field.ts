/**
 * Portal yanıt alanlarını okumak için paylaşılan ilkel dönüştürücüler.
 *
 * Bu üçlü daha önce `invoice.mapper.ts` ve `document.mapper.ts` içinde AYRI
 * AYRI duruyordu (`document.mapper.ts` bunu açıkça "kasıtlı kopya" diye
 * belgeliyordu). Makbuz modülleri de aynı ilkellere ihtiyaç duyuyor ve
 * kardeş modülden import etmek yasak; ortak ihtiyaç bu yüzden yaprak
 * `documents` katmanına indi. Artık dört tüketici tek bir davranışı
 * paylaşıyor — dört farklı kopyayı değil.
 */

/**
 * Bir alanı stringe çevirir. String ve sayı DIŞINDAKİ her şeyde varsayılana
 * düşer.
 *
 * DİKKAT: boş string GEÇERLİ bir stringtir ve varsayılanı TETİKLEMEZ. Bu kör
 * nokta I5'in kaynağıydı (`formatPortalDate('')` fırlatıyordu); tarih alanları
 * için doğrudan bu değil `normalizeSummaryDate` kullanılmalıdır.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz.
 *
 * @param value Portal yanıtındaki ham alan; her tip kabul edilir.
 * @param fallback String ve sayı DIŞINDAKİ değerlerde dönecek değer.
 *   Varsayılan boş string.
 * @returns Stringe çevrilmiş alan; sayı `String()` ile çevrilir.
 *
 * @example Girdi ve çıktı
 * ```text
 * str('abc')            -> 'abc'
 * str(42)               -> '42'
 * str('', 'VARSAYILAN') -> ''            // boş string varsayılanı TETİKLEMEZ
 * str(null, 'VARSAYILAN') -> 'VARSAYILAN'
 * ```
 */
export const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback

/**
 * Portalın sayısal alanlarını ayrıştırır.
 *
 * Türkçe biçim binlik ayırıcı olarak nokta, ondalık ayırıcı olarak virgül
 * kullanır (`"1.234,56"`). Eski sürüm yalnızca virgülü noktaya çeviriyordu
 * (`value.replace(',', '.')`) — binlik noktayı ayıklamadığı için
 * `"1.234,56"` `"1.234.56"` olarak `NaN`'a düşüyor ve ₺999 üzeri her tutar
 * sessizce 0 olarak raporlanıyordu (bkz. I4). Virgül varsa Türkçe biçim
 * kabul edilir (noktalar ayıklanır, virgül ondalık noktaya çevrilir);
 * virgül yoksa nokta zaten ondalık ayırıcıdır (`"1234.56"`, `"1234"`).
 *
 * Makbuz detay yanıtları tutarları STRING değil SAYI olarak döndürüyor
 * (canlı doğrulandı 2026-09-05: `birimFiyat: 100`); sayı dalı bu yüzden
 * yalnızca bir kısayol değil, makbuz okuma yolunun ana dalıdır.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz.
 *
 * @param value Portal yanıtındaki ham alan; sayı, string ya da başka bir tip.
 * @param fallback Ayrıştırma başarısız olursa dönecek değer. Varsayılan 0.
 * @returns Ayrıştırılmış sayı; sonlu olmayan ya da boş girdide `fallback`.
 *
 * @example Girdi ve çıktı
 * ```text
 * num(100)         -> 100        // makbuz detaylarının ana dalı
 * num('1234.56')   -> 1234.56    // virgül yoksa nokta ondalıktır
 * num('1.234,56')  -> 1234.56    // Türkçe biçim: binlik nokta ayıklanır
 * num('', 7)       -> 7
 * ```
 */
export const num = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed
    const parsed = Number(normalized)
    if (normalized.length > 0 && Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/**
 * Liste yanıtını satır dizisine çevirir. Portal bir hata durumunda dizi
 * yerine string veya `null` döndürebiliyor; bu durumda boş liste döner.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz.
 *
 * @param data Portal zarfının `data` alanı; her tip kabul edilir.
 * @returns Dizi ise AYNI dizi (kopyalanmaz), değilse boş dizi. Elemanların
 *   gerçekten nesne olduğu DOĞRULANMAZ — bu bir tip iddiasıdır.
 *
 * @example Girdi ve çıktı
 * ```text
 * asRows([{ ettn: 'a' }]) -> [{ ettn: 'a' }]
 * asRows(null)            -> []
 * asRows('Teknik bir hata oluştu.') -> []
 * ```
 */
export const asRows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : []
