# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır.

## [1.0.0] — 2026-09-05

İlk yayınlanan sürüm. (`0.1.0` yalnızca geliştirme sırasında kullanıldı,
npm'e hiç çıkmadı; aşağıdaki liste kapsamın tamamıdır.)

### Belgeler

- **Fatura** — oluşturma, listeleme (interaktif ve standart), okuma, silme
- **Müstahsil Makbuzu** — oluşturma, listeleme, okuma, HTML gösterimi;
  dört kesinti (gelir vergisi stopajı, mera fonu, borsa tescil ücreti,
  SGK prim kesintisi)
- **Serbest Meslek Makbuzu** — oluşturma, listeleme, okuma; brüt ücret →
  stopaj → KDV → KDV tevkifatı zinciri

### Oturum ve kimlik

- Giriş, çıkış, token saklama ve dışarıdan token verme
- Test ortamı için otomatik test kullanıcısı önerme
- Sunucu tarafı token süre dolumunun tespiti ve oturumun temizlenmesi

### Belge çıktısı

- HTML gösterimi
- Resmî belge paketi indirme — fatura ve müstahsil makbuzunda ZIP,
  serbest meslek makbuzunda doğrudan PDF
- Token taşıyan indirme adresi üretme
- Opsiyonel PDF üretimi (`puppeteer` peerDependency)

### Diğer

- Firma bilgisi okuma/güncelleme, VKN ile firma sorgulama
- SMS ile fatura imzalama
- İptal ve itiraz talepleri: oluşturma, listeleme, cevaplama
- Tam sayı kuruş aritmetiğiyle otomatik toplam hesaplama
- Türkçe alan adlarıyla giriş için `fromPortalPayload` kaçış kapısı
- Sıfır çalışma zamanı bağımlılığı; ESM ve CJS; tam Türkçe JSDoc

### Bilinen kısıtlar

Ayrıntıları README'nin "Bilinen kısıtlar" bölümündedir:

- Serbest Meslek Makbuzunun HTML gösterimi portalda bozuk (PDF indirme
  çalışıyor)
- Taslak silme test portalında hiçbir belge türünde çalışmıyor
- Portal makbuz tutarlarını hesaplamıyor ve doğrulamıyor; aritmetik
  güvencesi tamamen bu kütüphanededir
