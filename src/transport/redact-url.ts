/**
 * `token` sorgu parametresinin değerini gizler.
 *
 * `HttpClient.getBinary` çağrıları oturum token'ını URL sorgu dizesinde
 * taşır (`…/download?token=<128 karakterlik token>&…`). Bu URL, yeniden
 * deneme günlüklerine ve `EArsivNetworkError.url` alanına — dolayısıyla
 * çağıranın hata mesajına — sızabilir. `core/logger/logger.types.ts` "hassas
 * veri (token, şifre) buraya konmaz" diye söz veriyor; bu yardımcı o sözü
 * tutar.
 *
 * DİKKAT: `EArsivClient.getDownloadUrl` bu gizlemeyi UYGULAMAZ — orada amaç
 * çalışan bir indirme adresi vermektir; o URL canlı token taşır.
 *
 * @param url Gizlenecek adres. Mutlak olmayan veya ayrıştırılamayan bir metin
 *   de kabul edilir; o durumda `token=...` kalıbı regex ile temizlenir.
 * @returns `token` parametresinin değeri `***` ile değiştirilmiş adres.
 *   `token` parametresi yoksa adres olduğu gibi döner.
 *
 * DAHİLİ yardımcı: paket kökünden dışa açılmaz, `HttpClient` kullanır.
 *
 * @example Girdi ve çıktı
 * ```text
 * redactUrl('https://ornek.test/download?token=gizli&ettn=abc')
 *   -> 'https://ornek.test/download?token=***&ettn=abc'
 *
 * redactUrl('/download?token=gizli')   // mutlak olmayan adres de temizlenir
 *   -> '/download?token=***'
 * ```
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '***')
    }
    return parsed.toString()
  } catch {
    // Mutlak olmayan veya ayrıştırılamayan bir URL: yine de token=... kalıbını
    // regex ile temizle. Hiçbir durumda ham token'ı olduğu gibi bırakma.
    return url.replace(/([?&]token=)[^&]*/gi, '$1***')
  }
}
