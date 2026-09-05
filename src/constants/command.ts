/**
 * Portal `cmd` değerleri. Tamamı canlı test portalına karşı doğrulandı.
 * `VERIFY_SMS_CODE` adı portalın kendi tanımıdır; kısaltılmış değildir.
 */
export const Command = {
  GET_USER_MENU: 'getUserMenu',

  /** `assos-login` endpoint'inin `assoscmd` değerleri. */
  LOGIN: 'assos-login',
  SUGGEST_TEST_USER: 'kullaniciOner',

  CREATE_INVOICE: 'EARSIV_PORTAL_FATURA_OLUSTUR',
  LIST_INVOICES: 'EARSIV_PORTAL_TASLAKLARI_GETIR',
  LIST_INCOMING: 'EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR',
  /** "Portal Harici Adıma Düzenlenen Belgeler" — entegratör üzerinden gelen belgeler. */
  LIST_INCOMING_EXTERNAL: 'EARSIV_PORTAL_ENTEGRATOR_ADIMA_DUZENLENENLER_SORGULA',
  GET_INVOICE: 'EARSIV_PORTAL_FATURA_GETIR',
  DELETE_INVOICE: 'EARSIV_PORTAL_FATURA_SIL',

  /**
   * Makbuz belgeleri. Adlandırma portalın kendi ASİMETRİK yazımıdır ve
   * "düzeltilmemelidir": Müstahsil'de `MAKBUZU` sözcüğü hiç geçmez, Serbest
   * Meslek'te yalnızca OLUŞTURMA komutunda geçer, GETİRME komutunda geçmez.
   * Tanınmayan bir komut adı portalda "Bu işlem için yetkiniz yok" döner;
   * dördü de 2026-09-05'te canlı doğrulandı.
   */
  CREATE_PRODUCER_RECEIPT: 'EARSIV_PORTAL_MUSTAHSIL_OLUSTUR',
  GET_PRODUCER_RECEIPT: 'EARSIV_PORTAL_MUSTAHSIL_GETIR',
  CREATE_SELF_EMPLOYED_RECEIPT: 'EARSIV_PORTAL_SERBEST_MESLEK_MAKBUZU_OLUSTUR',
  GET_SELF_EMPLOYED_RECEIPT: 'EARSIV_PORTAL_SERBEST_MESLEK_GETIR',

  SHOW_INVOICE: 'EARSIV_PORTAL_FATURA_GOSTER',
  DOWNLOAD_DOCUMENT: 'EARSIV_PORTAL_BELGE_INDIR',

  GET_USER_INFO: 'EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR',
  SAVE_USER_INFO: 'EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET',
  GET_COMPANY_INFO: 'SICIL_VEYA_MERNISTEN_BILGILERI_GETIR',

  QUERY_PHONE: 'EARSIV_PORTAL_TELEFONNO_SORGULA',
  SEND_SMS_CODE: 'EARSIV_PORTAL_SMSSIFRE_GONDER',
  VERIFY_SMS_CODE: '0lhozfib5410mp',

  CREATE_CANCELLATION_REQUEST: 'EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR',
  CREATE_OBJECTION_REQUEST: 'EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR',
  LIST_DISPUTE_REQUESTS: 'EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR',
  RESPOND_TO_DISPUTE: 'EARSIV_PORTAL_IPTAL_ITIRAZ_TALEP_DURUM_GUNCELLE',
} as const

export type CommandName = (typeof Command)[keyof typeof Command]

/**
 * Yeniden denemesi GÜVENLİ komutlar — yalnızca salt okunur olanlar.
 *
 * Bir mutasyonun yeniden gönderilmesi, gerçek dünyada tekrarlanan bir hukuki
 * belge (mükerrer fatura) veya tekrarlanan bir durum değişikliği anlamına
 * gelir: sunucu isteği zaten işlemiş ama yanıt zaman aşımına uğramış olabilir
 * (bkz. C1). Bu yüzden varsayılan GÜVENLİ TARAF budur — burada YOKSA bir
 * komut yeniden denenmez. Yeni eklenen bir komut, tersi kanıtlanana kadar bu
 * kümenin DIŞINDA kalmalıdır.
 */
export const RETRYABLE_COMMANDS: ReadonlySet<CommandName> = new Set([
  Command.GET_USER_MENU,
  Command.LIST_INVOICES,
  Command.LIST_INCOMING,
  Command.LIST_INCOMING_EXTERNAL,
  Command.GET_INVOICE,
  Command.GET_PRODUCER_RECEIPT,
  Command.GET_SELF_EMPLOYED_RECEIPT,
  Command.SHOW_INVOICE,
  Command.GET_USER_INFO,
  Command.GET_COMPANY_INFO,
  Command.QUERY_PHONE,
  Command.LIST_DISPUTE_REQUESTS,
  Command.LOGIN,
  Command.SUGGEST_TEST_USER,
])

/**
 * Bazı komutlar hatayı HTTP 200 ve düz string `data` ile bildirir. Bu tabloda
 * kayıtlı bir komut string döndürdüğünde, metin bu kalıplardan en az birini
 * ALT METİN olarak içermiyorsa hata sayılır.
 */
export const SUCCESS_PATTERNS: Partial<Record<CommandName, readonly string[]>> = {
  [Command.CREATE_INVOICE]: ['Faturanız başarıyla oluşturulmuştur'],
  [Command.DELETE_INVOICE]: ['fatura başarıyla silindi'],
  // Makbuz cümleleri faturadan FARKLI ve birbirinden de farklı; belge türü
  // adı kalıbın içinde bırakıldı ki yanlış türe ait bir yanıt beyaz listeden
  // geçemesin (2026-09-05 canlı yanıtları).
  [Command.CREATE_PRODUCER_RECEIPT]: ['Müstahsil Makbuzunuz başarıyla oluşturulmuştur'],
  [Command.CREATE_SELF_EMPLOYED_RECEIPT]: ['Serbest Meslek Makbuzunuz başarıyla oluşturulmuştur'],
}

/**
 * Bu komutların düz string `data`sı bir DURUM MESAJI DEĞİL, BELGE
 * GÖVDESİDİR (ör. render edilmiş HTML). `SHOW_INVOICE` yanıtı 47-55 KB'lık
 * bir fatura HTML'i döndürür ve bu HTML kullanıcı tarafından girilen metin
 * taşır: fatura notu, alıcı ünvanı, kalem açıklaması. Bu metinler
 * `FAILURE_MARKERS`in aradığı Türkçe olumsuzluk/ret sözcükleriyle
 * (ör. "teslim edilemedi", "iade alınmıştır" içindeki "hata" alt metni gibi
 * rastlantısal eşleşmeler) çakışabilir — kısa durum mesajları için
 * tasarlanmış bir sezgi, tam bir belge gövdesine uygulanınca geçerli bir
 * faturayı hataya çevirir. Bu tabloda kayıtlı bir komut için parser,
 * FAILURE_MARKERS taramasını TAMAMEN ATLAR ve gövdeyi olduğu gibi döndürür.
 *
 * Bu güvenlidir: bu komutlar için gerçek başarısızlıklar zaten üst seviye
 * `error` veya `data.hata` alanlarından bildirilir (`parsePortalResponse`
 * bunları düz string dalından ÖNCE kontrol eder); düz string dalı bu
 * komutlar için yalnızca BAŞARI biçimidir.
 */
export const DOCUMENT_COMMANDS: ReadonlySet<CommandName> = new Set([Command.SHOW_INVOICE])

/**
 * Başarı metni bilinmeyen komutlar için hata tespiti.
 *
 * Yalnızca "başarıyla" kelimesini aramak güvenli değildi: Türkçede
 * "işleminiz başarıyla tamamlanamamıştır" gibi bir HATA mesajı da o kelimeyi
 * içerir ve alt metin araması bunu başarı sayardı. Bu yüzden başarı metnini
 * bilmediğimiz komutlarda tersine çeviriyoruz — metin aşağıdaki işaretlerden
 * birini taşıyorsa hatadır.
 *
 * İlk yedi desen canlı portaldan yakalanan gerçek hata metinlerinden geldi.
 * Sonuncusu Türkçe yeterlilik olumsuzluğunu yakalar: tamamlanamadı,
 * kaydedilemedi, oluşturulamaz, düzenlenememiştir.
 */
export const FAILURE_MARKERS: readonly RegExp[] = [
  // "hata" harfle önceden gelmemeli: aksi halde faturacılıkta standart bir
  // terim olan "muhatap" kelimesi hata sanılırdı. Kalıntı bir yanlış pozitif
  // olarak "Hatay" il adı kalıyor; başarı metinlerinde adres yankılanmadığı
  // için kabul edildi.
  /(^|[^\p{L}])hata/iu,
  /sorun var/i,
  /yetkiniz yok/i,
  /sağlamıyor/i,
  /uymuyor/i,
  /bulunamad/i,
  /geçersiz/i,
  /başarısız/i,
  /reddedil/i,
  /olumsuz/i,
  // Türkçe yeterlilik olumsuzluğu, kelime sonuna sabitlenmiş. Sabitleme şart:
  // serbest alt metin araması "Ramazan" içindeki "amaz" ile eşleşir ve masum
  // bir başarı mesajını hata sayardı. İzin verilen ekler gerçek portal
  // cümlelerinden: -tır/-dır, -sınız/-siniz, -nız/-niz, -lar/-ler.
  /(ama|eme)(dı|di|z|mış|miş)(?=[^\p{L}]|$|(?:tır|tir|dır|dir|sınız|siniz|nız|niz|lar|ler)(?:[^\p{L}]|$))/iu,
  // round 3 madde 1 — furkankadioglu#150 (açık): alıcı ticari e-Fatura
  // kullanıcısı olduğunda e-Arşiv faturası kesilemez; gerçek bir ret.
  /e-Fatura kullanıcısı/i,
  // round 3 madde 1 — furkankadioglu#6 (9 yorum): oturum süresi dolumu.
  /zaman aşımına uğradı/i,
]
