/**
 * `token` sorgu parametresinin değerini gizler.
 *
 * `HttpClient.getBinary` çağrıları oturum token'ını URL sorgu dizesinde
 * taşır (`…/download?token=<128 karakterlik token>&…`). Bu URL, yeniden
 * deneme günlüklerine ve `EArsivNetworkError.url` alanına — dolayısıyla
 * çağıranın hata mesajına — sızabilir. `core/logger/logger.types.ts` "hassas
 * veri (token, şifre) buraya konmaz" diye söz veriyor; bu yardımcı o sözü
 * tutar.
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
