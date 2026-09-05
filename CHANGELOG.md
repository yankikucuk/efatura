# Değişiklik Günlüğü

Bu proje [Semantic Versioning](https://semver.org/lang/tr/) kullanır.

## [0.1.0] — 2026-09-03

İlk sürüm.

### Eklenenler

- Oturum yönetimi: giriş, çıkış, token saklama, test kullanıcısı
- Fatura: oluşturma, listeleme (interaktif ve standart), okuma, silme
- Otomatik toplam hesaplama (tam sayı kuruş aritmetiği)
- Belge: HTML gösterimi, resmi paket indirme (ZIP), indirme adresi
- Firma bilgisi okuma/güncelleme, VKN ile firma sorgulama
- SMS ile fatura imzalama
- İptal ve itiraz talepleri: oluşturma, listeleme, cevaplama
- Opsiyonel PDF üretimi (puppeteer peerDependency)
- Türkçe alan adlarıyla giriş için `fromPortalPayload` kaçış kapısı
