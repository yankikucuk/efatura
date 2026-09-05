# Performans denetimi

Tarih: 2026-09-05 · Ortam: Node 26.8.1, macOS arm64 · Sürüm: 1.0.0

Aşağıdaki sayıların tamamı ÖLÇÜMDÜR. Yeniden üretmek için ilgili komutlar
her bölümde verilmiştir.

## Özet

Kodda performans darboğazı YOKTUR. Tüm sıcak yollar mikrosaniye altında
çalışır ve gerçek maliyet tamamen ağdadır — portalın kendi yanıt süresi ve
bir işlemin gerektirdiği istek SAYISI.

Tek dikkat edilmesi gereken konu paket boyutudur; bu bir çalışma zamanı
maliyeti değil, kurulum maliyetidir (bkz. §3).

## 1. Sıcak yollar

Her ölçüm ısıtma turundan sonra, işlem başına düşen süre olarak.

| İşlem | Süre |
| --- | --- |
| `parsePortalResponse` — başarı beyaz listesi eşleşmesi | 0,03 µs |
| `parsePortalResponse` — 11 hata deseniyle tarama | 0,17 µs |
| `parsePortalResponse` — 48 KB belge gövdesi (tarama atlanır) | 0,02 µs |
| ↳ kıyas: aynı belge 11 desenle taransaydı | 23,69 µs |
| `toDocumentSummary` × 1000 liste satırı | 250 µs |
| Müstahsil toplamları × 100 kalem | 208 µs |
| Serbest meslek toplamları × 100 kalem | 268 µs |

Kalem başına aritmetik maliyeti ~2 µs. Tam sayı kuruş üzerinden çalışmanın
ölçülebilir bir bedeli yoktur.

**Belge gövdesi satırı bir DOĞRULUK düzeltmesinin yan etkisidir.** Hata
sezgileri kısa durum mesajları için tasarlanmıştır; 48 KB'lık bir belge
gövdesine uygulandığında kullanıcının kendi yazdığı metin (ör. bir fatura
notundaki "teslim edilemedi") hata sanılıyordu. Düzeltme taramayı belge
yanıtlarında tamamen atlar; hızlanma (~1200×) bunun yan ürünüdür, amacı
değildir.

## 2. Soğuk import

Boş bir Node sürecinde paketi yüklemenin maliyeti:

| Biçim | Süre |
| --- | --- |
| ESM (`dist/index.js`) | 2,8 – 3,8 ms |
| CJS (`dist/index.cjs`) | 2,7 – 4,1 ms |

İki biçim pratikte aynı. Import anında hiçbir ağ, dosya sistemi veya kripto
işlemi yapılmaz; paket `sideEffects: false` işaretlidir. Çalışma zamanı
bağımlılığı sıfırdır, dolayısıyla geçişli bir yükleme maliyeti de yoktur.

## 3. Paket boyutu — tek gerçek gözlem

`npm pack --dry-run` ile ölçüldü:

| | Tarball (gzip) | Açılmış |
| --- | --- | --- |
| Mevcut | 502,5 KB | 2060,9 KB |
| Kaynak haritaları çıkarılsaydı | 273,4 KB | 1103,4 KB |

Açılmış boyutun dağılımı:

| Bileşen | Boyut | Pay |
| --- | --- | --- |
| Kaynak haritaları (`*.js.map`, `*.cjs.map`) | 957,4 KB | %46 |
| Tip tanımları (`*.d.ts`, `*.d.cts`) | 642,6 KB | %31 |
| Çalışma zamanı JavaScript (ESM + CJS) | 429,8 KB | %21 |

Boyut bu sürümde yaklaşık üçe katlandı. İki sebebi var ve ikisi de kasıtlı:
iki yeni belge türü (müstahsil ve serbest meslek makbuzu) ve public API'nin
tamamına yazılan Türkçe JSDoc. JSDoc `.d.ts` dosyalarına taşınır — kullanıcı
editöründe belgeleri bu sayede görür, yani bu boyut doğrudan bir fayda
karşılığıdır.

### Kaynak haritaları hakkında öneri: KALSIN

Gerekçe:

- **Çalışma zamanı maliyeti SIFIRDIR.** Kaynak haritaları yalnızca hata
  ayıklarken okunur; paketleyiciler (bundler) bunları çıktıya dahil etmez.
  Etkisi tek seferlik kurulum diskiyle sınırlıdır.
- Bu kütüphane, davranışı yer yer öngörülemeyen bir devlet portalıyla
  konuşur. Kullanıcı ayrıştırıcının derinlerinde bir hatayla karşılaştığında,
  TypeScript kaynağını gösteren gerçek bir yığın izi kayda değer bir fayda
  sağlar.
- 502 KB'lık bir tarball npm ölçeğinde büyük değildir.

Yine de kurulum boyutu kritik bir kısıtsa, `tsup.config.ts` içinde
`sourcemap: false` yapmak paketi %46 küçültür ve başka hiçbir şeyi
etkilemez.

## 4. Ağ — asıl maliyet burada

Test portalına karşı, Türkiye'den ölçüldü.

| İşlem | Portal isteği | Süre |
| --- | --- | --- |
| Listeleme / okuma / gösterim | 1 | ~130 – 150 ms |
| `getInvoiceHtml` (54 KB HTML) | 1 | ~267 ms |
| Oturum açma (test kullanıcısı) | 2 | ~1294 ms |
| `createDraft` ve makbuz oluşturma | 3 | ~680 ms |

Oluşturma çağrılarının üç istek yapması mimari bir tercih DEĞİLDİR: portal
oluşturma yanıtında ETTN döndürmüyor. Akış zorunlu olarak
`listele → oluştur → yeniden listele` şeklindedir ve yeni belge iki anlık
görüntünün farkından bulunur. İki liste çağrısı ~260 ms, yani toplam sürenin
%38'i — ama kaldırılamaz; kaldırılırsa oluşturulan belgenin ETTN'i hiçbir
şekilde öğrenilemez.

### Eşzamanlılık tavanı

Oluşturma çağrıları aynı istemci örneğinde sıraya alınır. Bu bilinçlidir:
paralel çalışsalardı ikisi de aynı "önce" anlık görüntüsünü görür ve fark
tekile inmediği için ikisi de `EArsivAmbiguousResultError` ile reddedilirdi —
oysa portalda iki belge de gerçekten oluşmuş olurdu.

Serileştirme YALNIZCA aynı örnek içindir. Aynı mükellef hesabı için ikinci
bir istemci açmak ya da işi ayrı süreçlere dağıtmak sorunu çözmez, geri
getirir: anlık görüntü farkı hesabın tamamına bakar.

Pratik tavan: hesap başına **~1,5 belge/saniye**. Bu sınır kütüphanenin
değil, portalın ETTN döndürmemesinin sonucudur.

## 5. Ölçülen ama sorun çıkmayan yerler

- **260 ülkelik sabit tablo**: düz bir nesne, import maliyetine katkısı
  ölçülemez düzeyde.
- **Lineer aramalar**: ETTN çözümünde "önceki" küme bir `Set`'tir; kalan
  `filter`/`find` çağrıları tarih aralığıyla sınırlı liste üzerinde çalışır.
  Kareselleşen bir yol yoktur.
- **Yeniden deneme**: varsayılan olarak KAPALIDIR; yalnızca salt okunur
  komutlar yeniden denenir. Bir zaman aşımı, sunucu isteği zaten işlemişken
  de oluşabileceği için mutasyon komutlarında tekrar deneme mükerrer hukuki
  belge üretebilirdi.

## Yeniden üretme

```bash
npm run build
npm pack --dry-run          # paket boyutu
node -e "const t=performance.now();import('./dist/index.js').then(()=>console.log(performance.now()-t))"
```

Ağ ölçümleri test portalına canlı istek gerektirir; `EFATURA_E2E=1 npm run test:e2e`
aynı yolları çalıştırır.
