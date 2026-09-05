## Ne değişti

<!-- Değişikliği ve nedenini kısaca anlatın. -->

## Neden

<!-- Hangi problemi çözüyor? Bir issue'ya bağlıysa: Closes #123 -->

## Nasıl doğrulandı

<!--
Testin GEÇTİĞİNİ yazmak yetmez; testin BAŞARISIZ OLABİLDİĞİNİ gösterin.
Bu projede yedi kez, adını taşıdığı davranış koddan silinse bile geçen bir
test gönderildi. Yeni bir test eklediyseniz, koruduğu üretim satırını
geçici olarak kaldırıp testin kırmızı olduğunu doğrulayın ve çıktıyı buraya
yapıştırın.
-->

- [ ] `npm test` geçiyor
- [ ] `npm run typecheck && npm run lint` temiz
- [ ] Yeni test eklendiyse, korumasız hâlde kırmızı olduğu doğrulandı
- [ ] Portal davranışıyla ilgiliyse canlı test portalına karşı denendi

## Kontrol listesi

- [ ] Çalışma zamanı bağımlılığı eklemedim (`dependencies` boş kalmalı)
- [ ] Public API değiştiyse JSDoc ve README güncellendi
- [ ] Portalın Türkçe alan adları yalnızca `*.mapper.ts` içinde kaldı
- [ ] Modüller arası (kardeş) import eklemedim
