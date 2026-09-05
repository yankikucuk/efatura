# efatura

GİB e-Arşiv Portalı için sıfır bağımlılıklı TypeScript istemcisi.

`earsivportal.efatura.gov.tr` üzerindeki e-Arşiv (perakende) belge akışını
kapsar ve **üç belge türünü** destekler: fatura, **müstahsil makbuzu** ve
**serbest meslek makbuzu**. Oturum açma, belge oluşturma/okuma/listeleme,
belge indirme, SMS ile imzalama ve iptal/itiraz talepleri dahildir. Çalışma
zamanı bağımlılığı yoktur; tüm istekler `fetch` ile yapılır.

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

### Müstahsil makbuzu

Aynı `client` üzerinden (yukarıdaki `Unit` import'u geçerli):

```ts
const receipt = await client.createProducerReceipt({
  producer: { taxOrIdentityNumber: '11111111111', firstName: 'Ayşe', lastName: 'Demir' },
  city: 'Konya',
  note: 'Eylül alımı',
  lineItems: [
    {
      name: 'Buğday',
      quantity: 100,
      unit: Unit.KILOGRAM,
      unitPrice: 12,
      // Dört kesintinin tamamı opsiyoneldir; verilmeyen sıfır sayılır.
      taxRates: { incomeTaxWithholding: 2, pastureFund: 1 },
    },
  ],
})

const detail = await client.getProducerReceipt(receipt.ettn)
// 1200 brüt, 24 + 12 kesinti, 1164 ödenecek: makbuzda vergiler EKLENMEZ, KESİLİR.
console.log(detail.totals.payableAmount)

const html = await client.getProducerReceiptHtml(receipt.ettn)
```

### Serbest meslek makbuzu

```ts
import { writeFile } from 'node:fs/promises'

const smm = await client.createSelfEmployedReceipt({
  payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.', taxOffice: 'Kadıköy' },
  description: 'Eylül 2026 danışmanlık',
  lineItems: [
    {
      description: 'Mali müşavirlik',
      grossFee: 10_000,
      vatRate: 20,
      withholdingRate: 20,
      // Mevzuattaki 5/10 kesri YÜZDE olarak verilir.
      vatWithholdingRate: 50,
    },
  ],
})

const smmDetail = await client.getSelfEmployedReceipt(smm.ettn)
// 10.000 brüt → 2.000 stopaj → 8.000 net ücret → 2.000 KDV → 1.000 tevkifat
// → 1.000 tahsil edilen KDV → 9.000 net alınan.
console.log(smmDetail.totals.netReceived)

// DİKKAT: SMM'nin portal HTML gösterimi BOZUKTUR ve bu çağrı ağa çıkmadan
// EArsivPortalDefectError fırlatır. Aşağıya bakın.
// client.getSelfEmployedReceiptHtml(smm.ettn)

// Basılabilir RESMİ belge yine de erişilebilir: portal SMM indirmesinde ZIP
// değil, doğrudan PDF döndürür.
const pdf = await client.downloadSelfEmployedReceiptPdf(smm.ettn)
await writeFile(`${smm.ettn}_s.pdf`, pdf)
```

Daha kapsamlı örnekler için `examples/` dizinine bakın:

- `examples/01-test-login.ts` — test kullanıcısıyla giriş
- `examples/02-create-invoice.ts` — çok kalemli fatura oluşturma
- `examples/03-download-document.ts` — HTML gösterimi ve belge indirme (her üç belge türü)
- `examples/04-dispute-request.ts` — iptal/itiraz talepleri

## Özellikler

- Oturum yönetimi: `login`, `loginWithTestUser`, `logout`, `setToken`
- Fatura: oluşturma (`createDraft`), listeleme (`listDrafts`, `listIncoming`,
  `listIncomingExternal`), okuma (`getInvoice`), silme (`cancelDraft` —
  varsayılan bugün, `{ date }` seçeneğiyle başka bir günün taslağı da
  hedeflenebilir; test portalında ÇALIŞMIYOR, bkz. "Bilinen kısıtlar")
- **Müstahsil Makbuzu**: oluşturma (`createProducerReceipt`), listeleme
  (`listProducerReceipts`), okuma (`getProducerReceipt`), HTML gösterimi
  (`getProducerReceiptHtml`), PDF (`producerReceiptToPdf`), resmi paket
  indirme (`downloadProducerReceiptPackage`, ZIP). Dört kesinti desteklenir:
  gelir vergisi stopajı, mera fonu, borsa tescil ücreti ve SGK primi
- **Serbest Meslek Makbuzu**: oluşturma (`createSelfEmployedReceipt`),
  listeleme (`listSelfEmployedReceipts`), okuma (`getSelfEmployedReceipt`),
  **resmi belge indirme (`downloadSelfEmployedReceiptPdf` — ZIP değil,
  doğrudan PDF)**. Brüt ücret → stopaj → net ücret → KDV → KDV tevkifatı →
  net alınan zinciri hesaplanır. Portalın HTML gösterimi
  (`getSelfEmployedReceiptHtml`, `selfEmployedReceiptToPdf`) PORTAL KUSURU
  nedeniyle DESTEKLENMEZ ve bu iki metot her zaman `EArsivPortalDefectError`
  fırlatır — ama basılabilir resmî belgeye indirme yoluyla erişilir (bkz.
  "Bilinen kısıtlar")
- Toplamların kalemlerden otomatik hesaplanması (tam sayı kuruş aritmetiği);
  `getInvoice` okurken kalemlerden yeniden HESAPLAMAZ, portalın kendi
  `matrah`/`hesaplanankdv`/`odenecekTutar` gibi resmi rakamlarını raporlar
- Belge: HTML gösterimi (`getInvoiceHtml`), resmi belge indirme
  (`downloadPackage` — `documentType` ile belge türü verilir), doğrudan
  indirme adresi (`getDownloadUrl`, `getProducerReceiptDownloadUrl`,
  `getSelfEmployedReceiptPdfUrl`)
- SMS ile fatura imzalama (`getPhoneNumber`, `sendSmsCode`, `verifySmsCode` —
  başarısızlıkta `EArsivApiError` fırlatır, `boolean` DÖNDÜRMEZ)
- İptal ve itiraz talepleri: oluşturma (`createCancellationRequest`,
  `createObjectionRequest`, `createObjectionRequestForIncoming`), listeleme,
  cevaplama
- Firma bilgisi okuma/güncelleme, VKN ile firma sorgulama
- Opsiyonel PDF üretimi (`toPdf`) — `puppeteer` peer bağımlılığı gerektirir

## Makbuz belgeleri hakkında bilmeniz gerekenler

### Aritmetiğin tek güvencesi bu kütüphanedir

Portal makbuz tutarlarını **ne hesaplıyor ne doğruluyor** (canlı doğrulandı):

- Kasıtlı olarak yanlış bir `odenecekTutar` gönderildiğinde portal onu aynen
  sakladı ve geri verdi — aritmetik olarak doğru değeri hesaplayıp
  düzeltmedi, uyarı da vermedi.
- Serbest meslek makbuzunda türetilmiş alanlar (`netUcret`, `netAlinan`)
  gönderilmediğinde portal bunları hesaplamadı, **0 olarak kaydetti**.

Yani faturadan farklı olarak makbuzda portal bir emniyet ağı değildir.
Kütüphanenin hesabı yanlışsa portal itiraz etmez, yanlış tutar hukuki belgeye
yazılır. Bu nedenle makbuzlarda `totals` override'ı **bilinçli olarak
açılmadı**: faturada override'ın karşılığında `mergeAndVerifyTotals` eşitlik
kontrolü var, makbuzda ise override'ın tek etkisi yanlış tutarın portala
gitmesini kolaylaştırmak olurdu.

### Makbuz listeleri bir ÜST KÜMEDEN süzülür

Portal makbuzlar için ayrı bir listeleme komutu sunmuyor.
`listProducerReceipts` ve `listSelfEmployedReceipts` fatura ile aynı taslak
listesini (`hangiTip: 'Buyuk'`) sorgular ve sonucu `belgeTuru` ile süzer;
bu liste fatura + iki makbuz türünü birden içerir.

### Okuma yolunda hangi rakam raporlanır

- **Müstahsil:** portal hem kalem hem belge düzeyinde tüm tutarları
  döndürüyor; hepsi portaldan okunur, yeniden hesaplanmaz.
- **Serbest meslek:** portal kalem düzeyinde türetilmiş tutarları (stopaj,
  KDV, KDV tevkifatı) hiç döndürmüyor, bu yüzden **kalem** değerleri
  oranlardan yeniden hesaplanır; **belge** toplamları ise portalın kendi
  kaydından okunur.

### `kdvTevkifatOrani` birimi doğrulanmış DEĞİLDİR

Mevzuat KDV tevkifat oranını kesirle anıyor (ör. 5/10). Bu kütüphane alanı
**yüzde** (0–100) olarak modelliyor: 5/10 → `vatWithholdingRate: 50`. Portal
bu alanı doğrulamıyor — `50` gönderildiğinde `50`, `5` gönderildiğinde `5`
saklıyor. Yani yüzde seçimi kütüphanenin sözleşmesidir, portalın teyidi
değildir.

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

| Sınıf                        | `kind`               | Ne zaman fırlatılır                                                             |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| `EArsivValidationError`      | `'validation'`       | İstek portala gönderilmeden önce yakalanan yerel doğrulama hatası               |
| `EArsivAuthError`            | `'auth'`             | Token yok, süresi dolmuş veya giriş reddedildi                                  |
| `EArsivApiError`             | `'api'`              | Portal iş mantığı veya yetki hatası döndürdü                                    |
| `EArsivAmbiguousResultError` | `'ambiguous-result'` | Sonuç (ör. yeni oluşturulan faturanın ETTN'i) tekil olarak belirlenemedi        |
| `EArsivNetworkError`         | `'network'`          | Zaman aşımı, DNS hatası, bağlantı kesintisi veya HTTP 5xx                       |
| `EArsivPortalDefectError`    | `'portal-defect'`    | PORTALIN kendi kusuru; ne çağıranın ne kütüphanenin düzeltebileceği bir şey var |

`EArsivPortalDefectError` diğerlerinden kasıtlı olarak ayrıdır: `validation`
"sen yanlış verdin", `api` "portal iş kuralıyla reddetti" demek. Portal kusuru
ise ikisi de değildir ve mevcut bir tipi kullanmak kullanıcıyı kendi kodunda
hata aramaya iterdi. Hata; portalın ham metnini (`portalMessage`), komutu
(`command`) ve varsa çalışan alternatifi taşır.

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

## Performans

Aşağıdaki değerler ölçümdür, tahmin değil. Kendiniz doğrulayabilirsiniz:
paket boyutu için `npm pack --dry-run`, import maliyeti için `dist/index.js`
ve `dist/index.cjs`'i tek seferlik bir Node süreci içinde yükleyin.

**Soğuk import.** Boş bir Node sürecinde kütüphaneyi yüklemenin maliyeti
**3–5 ms** (ölçüm: Node 26, macOS/arm64; ESM ve CJS pratikte aynı, makineye ve
disk önbelleğine göre değişir). Kütüphane yan etkisiz (`sideEffects: false`)
ve tek dosyaya
paketlenmiştir; import anında hiçbir ağ, dosya sistemi veya kripto işlemi
yapılmaz.

**Paket boyutu.** Yayınlanan paket **~250 KB tarball / ~970 KB açılmış** ve
**sıfır çalışma zamanı bağımlılığı** taşır (`dependencies: {}` — bu bir testle
sabitlenmiştir). Açılmış boyutun yarıdan fazlası kaynak haritalarıdır
(`*.js.map`, `*.cjs.map`); çalışma zamanı JavaScript'i her biçim için ~115 KB,
tip tanımları ~92 KB'tır. `puppeteer` yalnızca PDF isteyenler için opsiyonel
bir peer bağımlılıktır ve kurulmadıkça indirilmez.

**Portal istekleri.** Tek bir portal isteği yaklaşık **130–150 ms** sürüyor
(test portalı, Türkiye'den). Buradaki asıl maliyet istek SAYISINDADIR:

| İşlem                                                               | Portal isteği | Yaklaşık süre |
| ------------------------------------------------------------------- | ------------- | ------------- |
| Listeleme / okuma / gösterim                                        | 1             | ~130–150 ms   |
| `createDraft`, `createProducerReceipt`, `createSelfEmployedReceipt` | 3             | ~680 ms       |

Oluşturma çağrılarının üç istek yapmasının sebebi mimari bir tercih değil,
portalın davranışıdır: **portal oluşturma yanıtında ETTN döndürmüyor.** Bu
yüzden akış zorunlu olarak `listele → oluştur → yeniden listele` şeklindedir
ve yeni belge, iki liste anlık görüntüsünün farkından bulunur. İki liste
çağrısı KALDIRILAMAZ; kaldırılırsa oluşturulan belgenin ETTN'i hiçbir şekilde
öğrenilemez.

**Eşzamanlılık.** Aynı istemci örneği üzerinden yapılan eşzamanlı oluşturma
çağrıları sıraya alınır (serileştirilir). Bu bilinçlidir: paralel çalışsalardı
ikisi de aynı "önce" anlık görüntüsünü görür, ikisi de belge oluşturur ve
ikisi de farkı tekile indiremeyip `EArsivAmbiguousResultError` ile
reddedilirdi — oysa portalda iki belge de gerçekten oluşmuş olurdu.

Bu serileştirme yalnızca **aynı örnek** içindir. Aynı mükellef hesabı için
ikinci bir `EArsivClient` örneği açmak ya da işi ayrı süreçlere/sunuculara
dağıtmak sorunu ÇÖZMEZ, aksine geri getirir: anlık görüntü farkı hesabın
tamamına bakar. Yani oluşturma çağrılarının aktarım hızı tek hesap için
yaklaşık **saniyede 1,5 belge** ile sınırlıdır ve bu sınır kütüphanenin değil
portalın ETTN döndürmemesinin sonucudur.

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

İndirme uç noktası **belge türüne göre farklı format döndürür** ve bunu
kendisi söylemez. Sorgudaki `belgeTip` alanı belgenin türünü taşımak
zorundadır (canlı doğrulandı 2026-09-05):

| Belge türü             | Metot                            | `belgeTip`               | Format  | Dosya adı      |
| ---------------------- | -------------------------------- | ------------------------ | ------- | -------------- |
| Fatura                 | `downloadPackage`                | `FATURA`                 | ZIP     | `<ettn>_f.zip` |
| Müstahsil Makbuzu      | `downloadProducerReceiptPackage` | `MÜSTAHSİL MAKBUZU`      | ZIP     | `<ettn>_m.zip` |
| Serbest Meslek Makbuzu | `downloadSelfEmployedReceiptPdf` | `SERBEST MESLEK MAKBUZU` | **PDF** | `<ettn>_s.pdf` |

ZIP paketleri HTML gösterim (`<ettn>_f.html` / `<ettn>_m.html`) ve imzalı
UBL-TR XML (`<ettn>_f.xml` / `<ettn>_m.xml`) içerir; **PDF içermez**.
Serbest meslek makbuzunda ZIP hiç yoktur: portal doğrudan basılabilir resmî
PDF'i döndürür. Metot adları bu farkı söyler (`...Package` vs `...Pdf`);
`downloadPackage(ettn, { documentType })` ile aynı işi genel yoldan da
yapabilirsiniz, ama o zaman hangi formatın geleceğini çağrı yerinden okumak
mümkün olmaz.

`content-type` başlığı **üç türde de `application/json` yazar ve
YANILTICIDIR**. Formatı doğrulamanız gerekiyorsa yalnızca sihirli baytlara
güvenin: ZIP `PK\x03\x04`, PDF `%PDF`.

**Yanlış `belgeTip` SESSİZCE boş döner.** Bir makbuz ETTN'i `belgeTip=FATURA`
ile istendiğinde portal `HTTP 200` ve **0 bayt** döndürür; hata mesajı yoktur.
Kütüphane boş gövdeyi `EArsivNetworkError`'a çevirir, yani arıza sessiz
kalmaz. Hata TEŞHİS koyamaz — portal üç ayrı durumu (yanlış belge türü,
bilinmeyen ETTN, yanlış onay durumu) aynı boş yanıtla karşılıyor — ama üç
olasılığı da adıyla sayar ve ilk sırada belge türünü gösterir. Makbuzlarda
türe özel metotları kullanmanızın sebebi budur.

Fatura ve müstahsil için yerel PDF isterseniz `npm i puppeteer` ile peer
bağımlılığı kurup `client.toPdf(ettn)` / `client.producerReceiptToPdf(ettn)`
çağırabilirsiniz — bu, portalın HTML gösterimini yerel olarak PDF'e render
eder ve resmi imzalı belge yerine geçmez. Serbest meslek makbuzunda buna
gerek yoktur: `downloadSelfEmployedReceiptPdf` zaten portalın KENDİ resmî
PDF'ini verir.

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

## Bilinen kısıtlar

Bunlar kütüphanenin eksikleri değil, portalın gözlenmiş davranışlarıdır ve
kullanırken karşılaşacağınız için burada açıkça yazılmıştır.

### Serbest Meslek Makbuzunun portal HTML gösterimi BOZUK — ama resmi PDF'i erişilebilir

`EARSIV_PORTAL_FATURA_GOSTER` komutu geçerli bir SMM ETTN'i ile ham bir Java
istisnası döndürüyor: `{"error":"1","messages":["String index out of range: 4"]}`.
Denenen tüm varyantlar başarısız oldu — iki farklı `pageName`, ek `belgeTuru`
alanı, liste ETTN'i, detay ETTN'i, `belgeNumarasi`; alternatif komut adları
(`..._SERBEST_MESLEK_GOSTER`, `..._MAKBUZ_GOSTER`) portalda mevcut değil.
**Müstahsil Makbuzunda AYNI komut sorunsuz çalışıyor**, yani kusur SMM'ye
özgü ve istemci tarafında çözülemez.

Bu yüzden `getSelfEmployedReceiptHtml` ve `selfEmployedReceiptToPdf` metotları
**ağa hiç çıkmadan** `EArsivPortalDefectError` fırlatır. Metotlar bilinçli
olarak silinmedi: silinseydi çağıran `getInvoiceHtml`'i bir SMM ETTN'iyle
dener ve portalın ham istisnasını kendi hatası sanırdı.

**Kısıt yalnızca HTML GÖSTERİMİNİ kapsar.** Basılabilir resmî belgeye
erişebilirsiniz: indirme uç noktası SMM için doğrudan bir PDF döndürüyor
(canlı doğrulandı 2026-09-05).

```ts
// Veri:
const detail = await client.getSelfEmployedReceipt(ettn)
// Basılabilir RESMİ belge (ZIP değil, doğrudan PDF):
const pdf = await client.downloadSelfEmployedReceiptPdf(ettn)
```

Bu PDF, `selfEmployedReceiptToPdf`'in üreteceği yerel render DEĞİLDİR;
portalın kendi resmî belgesidir. Yani kısıt sizi resmî çıktıdan mahrum
bırakmaz — yalnızca HTML'i programatik olarak işlemenizi engeller.

Aynı istisna metni `getInvoiceHtml`/`toPdf` yolunda da yakalanıp çevrilir.
DİKKAT: portal bu metni SMM'ye özgü döndürmüyor — var olmayan ya da hatalı
biçimli bir ETTN de aynı metni üretiyor. Bu hatayı gördüğünüzde önce
ETTN'inizi doğrulayın.

### Taslak silme test portalında hiç çalışmıyor

`cancelDraft` API'si mevcuttur ve isteği doğru kurar, ancak
`EARSIV_PORTAL_FATURA_SIL` komutu test portalında her denemede
`"Silinirken bir sorun oluştu."` döndürüyor — **fatura dahil hiçbir belge
türünde çalışmıyor**. Denenen varyantlar: tam liste satırı ve minimal
`{belgeTuru, ettn}` yükü, `RG_TASLAKLAR` ve `RG_BASITTASLAKLAR` sayfa adları,
her üç belge türü.

Bu makbuz desteğiyle gelen bir gerileme değil, önceden var olan bir portal
davranışıdır. Üretim ortamında doğrulanamadı, çünkü doğrulamak gerçek bir
hukuki belge oluşturmayı gerektirirdi. `cancelDraft`'ı "çalışıyor" varsayarak
bir akış kurmayın.

Makbuzlar için silme API'si hiç eklenmedi.

### Portal makbuz tutarlarını doğrulamıyor

Ayrıntı için bkz. "Makbuz belgeleri hakkında bilmeniz gerekenler". Özet:
makbuzda aritmetiğin tek güvencesi bu kütüphanedir; portal yanlış bir tutarı
sessizce kabul eder.

### İndirme uç noktası oturumu açan istemcinin IP'sine bağlı

Bkz. "Belge paketi içeriği" altındaki not.

## Kapsam dışı

- e-Fatura (ticari, mükellefler arası) entegrasyonu — bu kütüphane yalnızca
  e-Arşiv (perakende) portalını hedefler.
- Desteklenen üç belge türü dışındaki e-Belge türleri (ör. e-İrsaliye,
  e-Bilet, e-Adisyon).
- Makbuzların SMS ile imzalanması ve makbuzlar için iptal/itiraz talepleri —
  bu akışlar makbuz belgelerinde hiç denenmedi; fatura için desteklenir.
- Taslak silme — API mevcut ama portal tarafında çalışmıyor (yukarıya bakın).
- Bir komut satırı arayüzü (CLI) — kütüphane yalnızca programatik kullanım
  içindir.

## Sorumluluk reddi

Bu kütüphane GİB'in (Gelir İdaresi Başkanlığı) resmi bir ürünü değildir ve
GİB tarafından desteklenmemektedir. Portalın kendisi belgelenmiş bir genel
API değildir; davranışı habersiz değişebilir. Üretimde kullanmadan önce
kendi ortamınızda doğrulayın.

## Lisans

MIT
