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
  GET_INVOICE: 'EARSIV_PORTAL_FATURA_GETIR',
  DELETE_INVOICE: 'EARSIV_PORTAL_FATURA_SIL',

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
 * Bazı komutlar hatayı HTTP 200 ve düz string `data` ile bildirir. Bu tabloda
 * kayıtlı bir komut string döndürdüğünde, metin bu kalıplardan en az birini
 * ALT METİN olarak içermiyorsa hata sayılır.
 */
export const SUCCESS_PATTERNS: Partial<Record<CommandName, readonly string[]>> = {
  [Command.CREATE_INVOICE]: ['Faturanız başarıyla oluşturulmuştur'],
  [Command.DELETE_INVOICE]: ['fatura başarıyla silindi'],
}

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
  /(ama|eme)(dı|di|z|mış|miş)/i,
]
