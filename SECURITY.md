# Güvenlik Politikası

Bu kütüphane mükellef kimlik bilgileriyle ve resmî belgelerle çalışıyor.
Güvenlik açıklarını ciddiye alıyoruz.

## Desteklenen sürümler

| Sürüm   | Güvenlik düzeltmesi alır |
| ------- | ------------------------ |
| `1.0.x` | Evet                     |
| `< 1.0` | Hayır                    |

Düzeltmeler yalnızca en son yayımlanan yama sürümü üzerinden gelir; eski
bir yama sürümüne geriye dönük düzeltme yapılmaz.

## Açık bildirme

**Güvenlik açıkları için herkese açık issue AÇMAYIN.** Açığın ayrıntısı,
yama yayımlanmadan önce görünür olursa kütüphaneyi canlı kullanan
mükellefler risk altında kalır.

Bildirim için GitHub'ın özel güvenlik danışma kanalını kullanın — bu
depoda etkindir:

**[Security → Report a vulnerability](https://github.com/yankikucuk/efatura/security/advisories/new)**

Bu kanal yalnızca siz ve depo sahibi tarafından görülebilir; yama hazır
olana kadar tartışma özel kalır.

Bildiriminizde şunlar varsa değerlendirme çok hızlanır:

- Etkilenen sürüm ve Node.js sürümü
- Açığı tetikleyen en küçük kod parçası
- Beklenen davranış ile gözlenen davranış
- Etkisi: hangi veri, kimin eline geçiyor

**Gerçek kimlik bilgisi, canlı portal token'ı veya gerçek bir mükellefe
ait belge göndermeyin.** Test portalı (`environment: 'test'`) çıktısı ya
da anonimleştirilmiş örnek yeterlidir.

### Ne bekleyebilirsiniz

Bu tek geliştiricili bir proje; süreler buna göre dürüstçe verilmiştir:

| Aşama                                | Hedef süre |
| ------------------------------------ | ---------- |
| İlk yanıt (bildirimin alındığı)      | 7 gün      |
| Geçerli/geçersiz değerlendirmesi     | 14 gün     |
| Düzeltme veya yol haritası bildirimi | 30 gün     |

Açık doğrulanırsa: yama yayımlanır, bir GitHub Security Advisory
yayımlanır ve — aksini istemezseniz — advisory'de adınız anılır.

Geçersiz bulunursa gerekçesini yazarım. Katılmıyorsanız aynı kanaldan
itiraz edebilirsiniz.

## Kapsam

### Kapsam içi

- Kimlik bilgisi veya token'ın istem dışı sızması, saklanması, log'lanması
- Portal yanıtının yanlış ayrıştırılması sonucu **başarısız bir işlemin
  başarılı sanılması** (ör. düzenlenmediği hâlde düzenlendi sanılan belge)
- Girdi doğrulamasının atlanabilmesi ve bunun portala hatalı belge
  göndermeye yol açması
- Tutar/vergi hesabında güvenlik sonucu doğuran hatalar
- Bağımlılık zincirindeki açıklar (kütüphanenin **çalışma zamanı
  bağımlılığı yoktur**; bu yüzey yalnızca geliştirme araçlarıdır)
- Bu depodaki CI/yayın altyapısının zayıflıkları

### Kapsam dışı

- **GİB e-Arşiv Portalı'nın kendi açıkları.** Bu kütüphane portalın
  istemcisidir, işleticisi değil. Portala ait sorunlar GİB'e bildirilmelidir.
  Portalın davranışından kaynaklanan ve kütüphanenin yanlış sonuç
  üretmesine yol açan durumlar ise kapsam içidir — bildirin.
- Kütüphaneyi çağıran uygulamanın kendi kimlik bilgilerini sızdırması
- Sosyal mühendislik, fiziksel erişim, GİB hesabının ele geçirilmesi
- Yalnızca kurulu olmayan bir yapılandırmada geçerli teorik senaryolar

## Kütüphaneyi güvenli kullanmak

Aşağıdakiler bilinen ve kasıtlı davranışlardır — açık değildir, ama
bilmezseniz kendi sisteminizde açık yaratabilirsiniz.

### Kimlik bilgileri ve token

- `login()` şifrenizi **saklamaz**; yalnızca portala iletir. Bellekte
  tutulan tek sır, portalın döndürdüğü oturum token'ıdır.
- Token **diske yazılmaz**, ortam değişkenine konmaz, log'lanmaz. Süreç
  bittiğinde kaybolur. Kalıcı saklamak isterseniz sorumluluk sizdedir;
  `client.token` ile okuyup kendi kasanıza koyun.
- İşiniz bitince `logout()` çağırın: kütüphane portala da oturum kapatma
  isteği gönderir, token yalnızca bellekten silinmez.
- Şifreyi koda gömmeyin; ortam değişkeni veya bir sır yöneticisi kullanın.

### Hata nesneleri ham portal yanıtını taşır

`EArsivApiError.raw` alanı, portaldan dönen **ham yanıtın tamamını**
taşır. Bu, hata ayıklamayı kolaylaştırmak için bilinçli bir seçimdir; ama
bu yanıt mükellefe ait belge verisi içerebilir.

```ts
try {
  await client.getInvoice(ettn)
} catch (error) {
  // Bunu YAPMAYIN: `raw`, belge içeriğini log toplayıcınıza taşır
  logger.error(error)

  // Bunu yapın: teşhis için gereken alanlar bunlar
  if (error instanceof EArsivApiError) {
    logger.error({
      command: error.command,
      callId: error.callId,
      code: error.code,
      message: error.message,
    })
  }
}
```

Aynı dikkat log'lama için de geçerli. Kütüphanenin varsayılan günlükleyicisi
`noopLogger`'dır: hiçbir şey yazmaz. Ama `logger` seçeneğiyle kendi
günlükleyicinizi verirseniz ne yazıldığı sizin sorumluluğunuzdadır — ve
`console.log(response)` yazarsanız belge içeriği log'lara düşer.

### Test ortamı ile canlı ortam

`environment: 'test'` GİB'in **test** portalına bağlanır ve orada
düzenlenen belgelerin hukuki geçerliliği yoktur. `loginWithTestUser()`
yalnızca test portalında çalışır. Canlı ortamda düzenlenen her belge
gerçektir ve iptali ayrı bir süreçtir — ortam ayarınızı dağıtımdan önce
doğrulayın.

### Sürüm ve bütünlük

- Kütüphanenin **çalışma zamanı bağımlılığı yoktur**; kurduğunuzda
  üçüncü taraf çalışma zamanı kodu gelmez.
- `puppeteer` yalnızca isteğe bağlı (`peerDependency`) PDF yolu içindir;
  kullanmıyorsanız kurmayın.
- Node.js 20 ve üzeri desteklenir. Ömrünü doldurmuş Node sürümlerinde
  çalıştırmayın.

## Bu depodaki güvenlik önlemleri

- **CodeQL** her push ve PR'da statik analiz yapar
- **Dependabot** güvenlik güncellemelerini ve gruplu bağımlılık
  yükseltmelerini açar
- **Secret scanning** ve **push protection** etkindir: yanlışlıkla
  commit'lenen bir anahtar push aşamasında engellenir
- **Dependency review** her PR'da yeni bağımlılıkların açıklarını denetler
- CI, desteklenen tüm Node sürümlerinde (20, 22, 24) çalışır

## Teşekkür

Sorumlu bildirimde bulunan herkese teşekkür ederiz. Geçerli bulunan her
bildirim, aksini istemediğiniz sürece yayımlanan advisory'de anılır.
