# efatura

GİB e-Arşiv Portalı için sıfır bağımlılıklı TypeScript istemcisi.

`earsivportal.efatura.gov.tr` üzerindeki e-Arşiv (perakende) fatura akışını
kapsar: oturum açma, fatura oluşturma/okuma/listeleme/silme, belge indirme,
SMS ile imzalama ve iptal/itiraz talepleri. Çalışma zamanı bağımlılığı yoktur;
tüm istekler `fetch` ile yapılır.

## Kurulum

```bash
npm i efatura
```

Node.js 20 veya üzeri gerekir (`fetch` global olarak kullanılabilir olmalı).

## Hızlı başlangıç

```ts
import { EArsivClient, Currency, Unit } from 'efatura'

const client = new EArsivClient({ environment: 'test' })
await client.loginWithTestUser()

const created = await client.createDraft({
  currency: Currency.TURKISH_LIRA,
  buyer: {
    taxOrIdentityNumber: '11111111111',
    firstName: 'Ali',
    lastName: 'Yılmaz',
    address: { city: 'İstanbul', district: 'Maltepe', street: 'Deneme Sk. No:1' },
  },
  lineItems: [
    { name: 'Yazılım Geliştirme', quantity: 28, unit: Unit.DAY, unitPrice: 3, vatRate: 20 },
  ],
})

console.log(created.ettn, created.documentNumber)
await client.logout()
```

Daha kapsamlı örnekler için `examples/` dizinine bakın:

- `examples/01-test-login.ts` — test kullanıcısıyla giriş
- `examples/02-create-invoice.ts` — çok kalemli fatura oluşturma
- `examples/03-download-document.ts` — HTML ve ZIP indirme
- `examples/04-dispute-request.ts` — iptal/itiraz talepleri

## Özellikler

- Oturum yönetimi: `login`, `loginWithTestUser`, `logout`, `setToken`
- Fatura: oluşturma (`createDraft`), listeleme (`listDrafts`, `listIncoming`,
  `listIncomingExternal`), okuma (`getInvoice`), silme (`cancelDraft` —
  varsayılan bugün, `{ date }` seçeneğiyle başka bir günün taslağı da
  hedeflenebilir)
- Toplamların kalemlerden otomatik hesaplanması (tam sayı kuruş aritmetiği);
  `getInvoice` okurken kalemlerden yeniden HESAPLAMAZ, portalın kendi
  `matrah`/`hesaplanankdv`/`odenecekTutar` gibi resmi rakamlarını raporlar
- Belge: HTML gösterimi (`getInvoiceHtml`), resmi paket indirme
  (`downloadPackage`, ZIP), doğrudan indirme adresi (`getDownloadUrl`)
- SMS ile fatura imzalama (`getPhoneNumber`, `sendSmsCode`, `verifySmsCode` —
  başarısızlıkta `EArsivApiError` fırlatır, `boolean` DÖNDÜRMEZ)
- İptal ve itiraz talepleri: oluşturma (`createCancellationRequest`,
  `createObjectionRequest`, `createObjectionRequestForIncoming`), listeleme,
  cevaplama
- Firma bilgisi okuma/güncelleme, VKN ile firma sorgulama
- Opsiyonel PDF üretimi (`toPdf`) — `puppeteer` peer bağımlılığı gerektirir

## Gelen belgeler: portal vs entegratör

Adınıza düzenlenen belgeler İKİ ayrı yoldan gelebilir ve portal bunları İKİ
farklı ekranda/komutta listeler:

- `listIncoming(from, to)` — yalnızca PORTALIN KENDİSİ üzerinden düzenlenen
  belgeler ("Adıma Kesilen Belgeler").
- `listIncomingExternal(from, to, filters?)` — bir ENTEGRATÖR aracılığıyla
  (portalın kendisi DEĞİL) düzenlenen belgeler ("Portal Harici Adıma
  Düzenlenen Belgeler"). Pratikte büyük firmalardan gelen B2B faturaların
  çoğu bu yolla gelir ve `listIncoming` bunları GÖSTERMEZ.

```ts
const fromPortal = await client.listIncoming(new Date('2026-09-01'), new Date())
const fromIntegrators = await client.listIncomingExternal(
  new Date('2026-09-01'),
  new Date(),
  { sellerTaxOrIdentityNumber: '9999999999' }, // üç filtre de opsiyonel
)
```

`listIncomingExternal`'ın satır tipi (`IncomingExternalSummary`)
`listIncoming`'inkinden (`InvoiceSummary`) FARKLIDIR: bu listede siz her
zaman alıcı olduğunuz için satır, alıcı kimliği yerine SATICI kimliğini
(`sellerTaxOrIdentityNumber`, `sellerName`) ve entegratörün kendi verdiği ayrı
bir fatura numarasını (`invoiceNumber`) taşır.

## PHP kütüphanesinden farklar

Bu kütüphane, aynı portalı hedefleyen mevcut PHP kütüphanelerinden bilinçli
olarak üç noktada ayrılır:

- **`faturaUuid` artık gönderilmiyor.** Eski yaklaşım istemci tarafında bir
  UUID üretip portala gönderiyordu; bu kütüphane ETTN'i portalın kendisinin
  atamasına bırakır. Portal `EARSIV_PORTAL_FATURA_OLUSTUR` yanıtında ETTN
  döndürmediği için `createDraft`, oluşturma öncesi ve sonrası taslak
  listesinin anlık görüntüsünü karşılaştırarak yeni kaydı bulur. Fark tekil
  bir kayda inmezse — örneğin portal listeyi henüz güncellememişse veya aynı
  anda birden fazla taslak oluşturulmuşsa — yanlış bir ETTN döndürmek yerine
  `EArsivAmbiguousResultError` fırlatılır; adaylar hatanın `candidates`
  alanında bulunur. Bu yüzden `createDraft`, AYNI alıcı ve AYNI tarih için
  eşzamanlı (paralel) çağrılmamalıdır — iki oluşturma isteği aynı anda
  çakışırsa anlık görüntü farkı tekile inmez ve ETTN çözümü belirsizleşir.
- **Toplamlar kalemlerden otomatik hesaplanır.** İskonto, KDV matrahı ve genel
  toplam gibi alanları elle hesaplayıp göndermeniz gerekmez; `lineItems`
  girdisinden tam sayı kuruş aritmetiğiyle türetilir. İsterseniz `totals` ile
  bir değeri override edebilirsiniz — bu durumda hesaplanan değerle
  tutarlılığı doğrulanır, uyuşmazsa istek ağa çıkmadan reddedilir.
- **Hiçbir hata yutulmaz.** PHP kütüphanesindeki `die()` çağrıları yerine
  altı tipli hata sınıfından biri fırlatılır (aşağıya bakın); çağıran taraf
  `instanceof` ile ayırt edip programatik olarak ele alabilir.

## Hata yönetimi

Tüm hatalar `EArsivError` soyut sınıfından türer ve ayırt edici bir `kind`
alanı taşır:

| Sınıf                        | `kind`               | Ne zaman fırlatılır                                                      |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------ |
| `EArsivValidationError`      | `'validation'`       | İstek portala gönderilmeden önce yakalanan yerel doğrulama hatası        |
| `EArsivAuthError`            | `'auth'`             | Token yok, süresi dolmuş veya giriş reddedildi                           |
| `EArsivApiError`             | `'api'`              | Portal iş mantığı veya yetki hatası döndürdü                             |
| `EArsivAmbiguousResultError` | `'ambiguous-result'` | Sonuç (ör. yeni oluşturulan faturanın ETTN'i) tekil olarak belirlenemedi |
| `EArsivNetworkError`         | `'network'`          | Zaman aşımı, DNS hatası, bağlantı kesintisi veya HTTP 5xx                |

Portalın "Bu işlem için yetkiniz yok" metni hem GERÇEK bir izin kısıtlaması
hem de sunucu tarafında süresi dolmuş bir token için AYNI şekilde geliyor —
metnin kendisi ikisini ayırt etmiyor. Bu yüzden istemci, bu metni gördüğünde
zararsız bir prob isteği (`getUserMenu`) atarak hangisi olduğunu doğrular:
prob başarılı olursa token sağlamdır ve orijinal `EArsivApiError` olduğu gibi
yükselir (oturumunuz bozulmaz); prob da aynı metinle başarısız olursa token
gerçekten ölüdür, kütüphane onu temizler ve `EArsivAuthError` fırlatır
(orijinal hata `cause` alanında bulunur). Sonuç: `isAuthenticated`'ın
`false`'a düşmesi yalnızca token'ın gerçekten geçersiz olduğu kanıtlandığında
olur; sıradan bir izin reddi oturumunuzu sonlandırmaz.

```ts
import { EArsivApiError, EArsivClient } from 'efatura'

try {
  await client.createCancellationRequest({ ettn, reason: 'Yanlış tutar.' })
} catch (error) {
  if (error instanceof EArsivApiError) {
    console.error('Portal reddetti:', error.message, error.code)
  } else {
    throw error
  }
}
```

## Yeniden deneme davranışı

`retry.attempts` (varsayılan 3) yalnızca **salt okunur** komutlar için
geçerlidir — oturum açma, listeleme, okuma, belge görüntüleme/indirme gibi.
Bu istekler yapılandırılmış deneme sayısına kadar üstel geri çekilmeyle
(`retry.backoffMs`, her denemede ikiye katlanarak) yeniden denenir.

**Mutasyon niteliğindeki her komut** — fatura oluşturma, silme, kullanıcı
bilgisi kaydetme, SMS gönderme/doğrulama, iptal/itiraz talebi oluşturma,
talebe cevap verme — `retry.attempts` ne olursa olsun **tam olarak bir kez**
denenir. Sebep: bir zaman aşımı, sunucu isteği zaten işleyip yanıtı
gönderemeden fırlayabilir; bu durumda mutasyonu yeniden denemek mükerrer bir
hukuki belgeyle (mükerrer fatura, mükerrer silme, mükerrer imzalama...)
sonuçlanır. `retry.attempts: 5` vermek bu davranışı DEĞİŞTİRMEZ — yalnızca
okuma komutları 5 kez denenir, her mutasyon yine tek seferde denenir.

## Test ortamı

Portalın ayrı bir test ortamı vardır: `earsivportaltest.efatura.gov.tr`.
`environment: 'test'` ile bu ortama bağlanılır ve `loginWithTestUser()` ile
portalın kendi ürettiği bir kullanıcıyla (kullanıcı adı otomatik, şifre her
zaman `"1"`) oturum açılır — gerçek bir GİB hesabı gerekmez ve hiçbir gerçek
belge düzenlenmez.

Bu test kullanıcıları portalı kullanan herkes arasında paylaşılır; aynı
kullanıcıya başka geliştiricilerin de kayıtları düşebilir. Alıcı ünvanına
rastgele bir damga eklemek (bkz. `tests/e2e`), kendi oluşturduğunuz kayıtları
listede güvenilir biçimde ayırt etmenizi sağlar.

## Belge paketi içeriği

`downloadPackage(ettn)` resmi belge paketini bir ZIP olarak indirir. Paket
`<ettn>_f.html` (HTML gösterim) ve imzalı `<ettn>_f.xml` (UBL-TR) dosyalarını
içerir; **PDF içermez**. PDF isterseniz `npm i puppeteer` ile peer
bağımlılığı kurup `client.toPdf(ettn)` çağırabilirsiniz — bu, portalın HTML
gösterimini yerel olarak PDF'e render eder ve resmi imzalı belge yerine
geçmez.

### İndirme uç noktası istemci IP'sine bağlıdır

Portal, belge indirme oturumunu oturumu AÇAN istemcinin IP adresine
bağlıyor gibi görünüyor (`furkankadioglu#140`): bir kullanıcı fatura
oluşturup HTML'i kendi sunucusundan çekebiliyor, ama ZIP indirme
`"Oturum geçersiz (clientIP)"` hatasıyla başarısız oluyor — yerelde
çalışıyor, sunucudan çalışmıyor. Yanıtta çağıranın IP'sini yansıtan bir
`CIP:` başlığı gözlemlendi.

Sonuç: bir host'ta alınan token, BAŞKA bir host'tan indirme için
kullanılamaz; oturum sırasında değişen bir çıkış IP'si (bazı proxy'ler, NAT
havuzları, serverless ortamlar) aynı `"Oturum geçersiz (clientIP)"` hatasını
üretir. `getDownloadUrl`'ün döndürdüğü URL de AYNI kısıtlamaya tabidir —
URL'yi başka bir host'a taşıyıp orada açmak da aynı şekilde başarısız olur.

## İptal/itiraz ön koşulu

`createCancellationRequest`, `createObjectionRequest` ve
`createObjectionRequestForIncoming` yalnızca **onaylanmış (imzalanmış)** bir
belge için çalışır ve her belge için en fazla bir kez açılabilir; taslak veya
daha önce talebi açılmış bir belgede portal iş kuralı hatası döndürür
(`EArsivApiError`).

### İki itiraz yükü: kendi belgeniz vs adınıza düzenlenmiş belge

Portal, itiraz talebi için EKRANA göre farklı yük bekler — `createObjectionRequest`
ve `createObjectionRequestForIncoming` bu ikisini KARIŞTIRMAZ:

- `createObjectionRequest(input)` — **kendi düzenlediğiniz** bir belgeye
  itiraz (yedi alan: `ettn`, `method`, `referenceDocumentId`,
  `referenceDocumentDate`, `reason`, opsiyonel `approvalStatus`/`documentType`).
  Nadir bir senaryodur; çoğu kullanım aşağıdakidir.
- `createObjectionRequestForIncoming(input)` — **adınıza düzenlenmiş**
  (portal veya entegratör) bir belgeye itiraz — kütüphanenin belgelediği asıl
  kullanım durumu. Yukarıdaki yedi alana ek olarak `invoiceOid` (`faturaOid`),
  `totalAmount` (`toplamTutar`), `sellerTaxOrIdentityNumber` (`saticiVknTckn`)
  ve `documentNumber` (`belgeNumarasi`) ZORUNLUDUR — bu dört alan
  `listIncoming`/`listIncomingExternal` satırlarından okunur. Portal bu
  yükleri farklı sayfalara (`RG_TASLAKLAR` vs `RG_ALICI_TASLAKLAR`) gönderiyor
  olarak doğrular; yanlış eşleşme "Bu işlem için yetkiniz yok" hatasına yol
  açar.

## Kapsam dışı

- e-Fatura (ticari, mükellefler arası) entegrasyonu — bu kütüphane yalnızca
  e-Arşiv (perakende) portalını hedefler.
- Serbest Meslek Makbuzunun HTML gösterimi ve PDF çıktısı — portalın kendi
  kusuru (`String index out of range: 4`); istemci tarafında çözülemiyor,
  bu yüzden açılmadı. Makbuzun verilerine `getSelfEmployedReceipt` ile
  erişilir. Müstahsil Makbuzunda aynı özellik ÇALIŞIR.
- Bir komut satırı arayüzü (CLI) — kütüphane yalnızca programatik kullanım
  içindir.

## Sorumluluk reddi

Bu kütüphane GİB'in (Gelir İdaresi Başkanlığı) resmi bir ürünü değildir ve
GİB tarafından desteklenmemektedir. Portalın kendisi belgelenmiş bir genel
API değildir; davranışı habersiz değişebilir. Üretimde kullanmadan önce
kendi ortamınızda doğrulayın.

## Lisans

MIT
