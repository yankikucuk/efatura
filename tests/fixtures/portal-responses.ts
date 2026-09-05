/** 2026-09-03 tarihinde canlı test portalından alınan gerçek yanıtlar. */
export const portalResponses = {
  unauthorized: {
    error: '1',
    messages: [{ type: '7', text: 'Bu işlem için yetkiniz yok' }],
  },
  systemError: {
    error: '1',
    messages: ['Genel Sistem Hatası:java.lang.NullPointerException'],
  },
  businessError: {
    data: { hata: 'Düzenlenmek üzere fatura getirilemedi. Hata kodu: 2-1109' },
    metadata: { optime: '20260903193002+0300' },
  },
  ettnRejected: {
    data: 'Ettn ya eksik ya boş ya da 36 uzunluk sınırına uymuyor.',
    metadata: { optime: '20260903193207+0300' },
  },
  invoiceCreated: {
    data: 'Faturanız başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden faturanıza ulaşabilirsiniz.',
    metadata: { optime: '20260903193207+0300' },
  },
  draftList: {
    data: [
      {
        belgeNumarasi: 'GIB2026000000917',
        aliciVknTckn: '11111111111',
        aliciUnvanAdSoyad: 'NODE PROBE A1B2C3',
        belgeTarihi: '03-09-2026',
        belgeTuru: 'FATURA',
        onayDurumu: 'Onaylanmadı',
        ettn: '3729b07c-f9a4-46f1-ac46-eb88f5ccea84',
      },
    ],
    metadata: { optime: '20260903193207+0300' },
  },
  userInfo: {
    data: {
      vknTckn: '3333333301',
      unvan: 'DENEME LISANS TICARET ANONIM SIRKETI',
      ad: '',
      soyad: '',
      cadde: 'Esentepe Mahallesi Test Caddesi',
      apartmanAdi: 'Test Plaza',
      apartmanNo: '12',
      kapiNo: '3',
      kasaba: '',
      ilce: 'Sisli',
      il: 'Istanbul',
      postaKodu: '34394',
      ulke: 'Türkiye',
      telNo: '2125550142',
      faksNo: '',
      ePostaAdresi: 'deneme@ornek.test',
      webSitesiAdresi: '',
      vergiDairesi: 'Sisli',
      sicilNo: '33333301',
      isMerkezi: 'Test Plaza',
      mersisNo: '0123456789012345',
    },
    metadata: { optime: '20260903192857+0300' },
  },
  emptyDisputeList: { data: [], metadata: { optime: '20260903200049+0300' } },
  /**
   * EARSIV_PORTAL_FATURA_GETIR'in BAŞARILI yanıtı. Portal başarıda da `hata`
   * alanını gönderiyor — boş string olarak. Canlı test portalından alındı.
   */
  invoiceDetailSuccess: {
    data: {
      hata: '',
      faturaUuid: '3729b07c-f9a4-46f1-ac46-eb88f5ccea84',
      belgeNumarasi: 'GIB2026000000917',
      faturaTarihi: '03/09/2026',
      saat: '19:30:02',
      paraBirimi: 'TRY',
      dovzTLkur: 0,
      faturaTipi: 'SATIS',
      vknTckn: '11111111111',
      aliciAdi: 'TEST',
      aliciSoyadi: 'MUSTERI',
      malHizmetTable: [],
      not: '',
    },
    metadata: { optime: '20260903193207+0300' },
  },
  /**
   * 2026-09-05 canlı yakalamaları — makbuz belgeleri.
   * Tümü `earsivportaltest.efatura.gov.tr` üzerinde `kullaniciOner` ile
   * tahsis edilmiş test kullanıcılarıyla, tek oturum içinde alındı.
   */
  producerReceiptCreated: {
    data: 'e-Arşiv Portal Müstahsil Makbuzunuz başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden makbuzunuza ulaşabilirsiniz.',
    metadata: { optime: '20260905193853+0300' },
  },
  selfEmployedReceiptCreated: {
    data: 'e-Arşiv Portal Serbest Meslek Makbuzunuz başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden makbuzunuza ulaşabilirsiniz.',
    metadata: { optime: '20260905193853+0300' },
  },
  /**
   * `hangiTip: 'Buyuk'` listesi. Bir ÜST KÜMEDİR: iki müstahsil + bir SMM
   * satırı birlikte döndü. Müstahsil satırlarında `aliciUnvanAdSoyad` alanı
   * HİÇ YOK; SMM satırında var ve `adi + soyadi` birleşimidir (`unvan`
   * DEĞİL — ayrı bir çalıştırmada yalnızca `unvan` verildiğinde bu alan boş
   * string döndü).
   */
  receiptDraftList: {
    data: [
      {
        belgeNumarasi: 'GIB2026000000014',
        aliciVknTckn: '11111111111',
        belgeTarihi: '05-09-2026',
        belgeTuru: 'MÜSTAHSİL MAKBUZU',
        onayDurumu: 'Onaylanmadı',
        ettn: 'caf584f7-2b42-4775-b6da-2e4d01bb534d',
      },
      {
        belgeNumarasi: 'GIB2026000000013',
        aliciVknTckn: '11111111111',
        belgeTarihi: '05-09-2026',
        belgeTuru: 'MÜSTAHSİL MAKBUZU',
        onayDurumu: 'Onaylanmadı',
        ettn: 'e1638ef2-548e-4932-bd14-1b5ddeb4cd7b',
      },
      {
        belgeNumarasi: 'GIB2026000000245',
        aliciVknTckn: '11111111111',
        aliciUnvanAdSoyad: 'PROBE SERBEST',
        belgeTarihi: '05-09-2026',
        belgeTuru: 'SERBEST MESLEK MAKBUZU',
        onayDurumu: 'Onaylanmadı',
        ettn: '7ae53b5f-d5a5-489b-9ba1-fe5801a8a209',
      },
    ],
    metadata: { optime: '20260905193853+0300' },
  },
  /**
   * `EARSIV_PORTAL_MUSTAHSIL_GETIR`. Kimlik alanı `uuid` (faturada
   * `faturaUuid`). Tutarlar STRING değil SAYI olarak dönüyor. `not` alanı
   * sonuna `\n` EKLENEREK dönüyor. Belge düzeyi vergi toplamlarından yalnızca
   * SGK_PRIM olanı `Tutari` ekiyle bitiyor.
   */
  producerReceiptDetail: {
    data: {
      uuid: 'caf584f7-2b42-4775-b6da-2e4d01bb534d',
      tarih: '05/09/2026',
      saat: '19:38:52',
      vknTckn: '11111111111',
      aliciAdi: 'PROBE',
      aliciSoyadi: 'MUSTAHSIL',
      sehir: 'İstanbul',
      websitesi: 'https://ornek.test',
      belgeNumarasi: 'GIB2026000000014',
      mustahsilTable: [
        {
          malHizmet: 'Ceviz',
          miktar: 10,
          birim: 'KGM',
          birimFiyat: 100,
          malHizmetTutari: 1000,
          v0003Tutari: 20,
          v0003Orani: 2,
          v9040Tutari: 10,
          v9040Orani: 1,
          v8001Tutari: 5,
          v8001Orani: 0.5,
          vSGK_PRIMTutari: 10,
          vSGK_PRIMOrani: 1,
        },
      ],
      malhizmetToplamTutari: 1000,
      hesaplananv0003: 20,
      hesaplananv9040: 10,
      hesaplananv8001: 5,
      hesaplananvSGK_PRIMTutari: 10,
      not: 'Makbuz notu\n',
      vergilerDahilToplamTutar: 1000,
      odenecekTutar: 955,
      teslimTarih: '05/09/2026',
      hata: '',
    },
    metadata: { optime: '20260905193854+0300' },
  },
  /**
   * KASITLI YANLIŞ `odenecekTutar` ile oluşturulup geri okunan müstahsil
   * makbuzu: doğrusu 98,00 iken 77,77 gönderildi ve portal 77,77 olarak
   * SAKLADI. Portal makbuz tutarlarını YENİDEN HESAPLAMIYOR ve
   * DOĞRULAMIYOR — aritmetiğin tek güvencesi bu kütüphanedir.
   */
  producerReceiptDetailStoredWrongTotals: {
    data: {
      uuid: 'ff843c4b-4bbe-4351-bdae-a6eacbcfa2ab',
      tarih: '05/09/2026',
      saat: '19:39:56',
      vknTckn: '11111111111',
      aliciAdi: 'TOTALS',
      aliciSoyadi: 'PROBE',
      sehir: 'İstanbul',
      websitesi: '',
      belgeNumarasi: 'GIB2026000000010',
      mustahsilTable: [
        {
          malHizmet: 'Findik',
          miktar: 1,
          birim: 'KGM',
          birimFiyat: 100,
          malHizmetTutari: 100,
          v0003Tutari: 2,
          v0003Orani: 2,
          v9040Tutari: 0,
          v9040Orani: 0,
          v8001Tutari: 0,
          v8001Orani: 0,
          vSGK_PRIMTutari: 0,
          vSGK_PRIMOrani: 0,
        },
      ],
      malhizmetToplamTutari: 100,
      hesaplananv0003: 2,
      hesaplananv9040: 0,
      hesaplananv8001: 0,
      hesaplananvSGK_PRIMTutari: 0,
      vergilerDahilToplamTutar: 100,
      odenecekTutar: 77.77,
      teslimTarih: '05/09/2026',
      hata: '',
    },
    metadata: { optime: '20260905194030+0300' },
  },
  /**
   * `EARSIV_PORTAL_SERBEST_MESLEK_GETIR`. Kimlik alanı `ettn` (müstahsilde
   * `uuid`). Kalem TÜRETİLMİŞ tutarları (stopaj, KDV, KDV tevkifatı)
   * DÖNDÜRMÜYOR — yalnızca oranlar ve `netUcret`/`netAlinan` var.
   * `kdvTahakkukIcin` BOOLEAN olarak dönüyor.
   */
  selfEmployedReceiptDetail: {
    data: {
      ettn: '7ae53b5f-d5a5-489b-9ba1-fe5801a8a209',
      belgeNumarasi: 'GIB2026000000245',
      tarih: '05/09/2026',
      saat: '19:38:52',
      vknTckn: '11111111111',
      adi: 'PROBE',
      soyadi: 'SERBEST',
      unvan: '',
      bulvarCaddeSokak: 'Test Sk.',
      binaAdi: '',
      binaNo: '',
      kapiNo: '',
      kasabaKoy: '',
      mahalleSemtIlce: '',
      sehir: 'İstanbul',
      postaKodu: '',
      ulke: 'Türkiye',
      paraBirimi: 'TRY',
      kur: 0,
      serbestTable: [
        {
          neIcinAlindigi: 'Danışmanlık',
          brutUcret: 1000,
          stopaj: 20,
          netUcret: 800,
          kdv: 20,
          kdvTevkifatOrani: 50,
          netAlinan: 900,
        },
      ],
      aciklama: 'SMM notu',
      brtUcret: 1000,
      gvStpjTtari: 200,
      netUcretTtr: 800,
      kdvTtri: 200,
      kdvTvkftTtri: 100,
      thsilEdilenKdv: 100,
      netAlinanToplam: 900,
      kdvTahakkukIcin: false,
      vergiDairesi: 'Maltepe',
      hata: '',
    },
    metadata: { optime: '20260905193854+0300' },
  },
  /**
   * Kalem düzeyinde `netUcret`, `kdvTevkifatOrani` ve `netAlinan`
   * GÖNDERİLMEDEN oluşturulan SMM'nin geri okunması: portal eksik alanları
   * hesaplamadı, 0 olarak SAKLADI. Belge düzeyi toplamlar ise gönderildikleri
   * gibi geri geldi — yani portal bir depo, bir hesap makinesi değil.
   */
  selfEmployedReceiptDetailMissingLineDerivations: {
    data: {
      ettn: '0b4bd348-9915-4903-b679-e20c3f1e4eb9',
      belgeNumarasi: 'GIB2026000000032',
      tarih: '05/09/2026',
      saat: '19:39:56',
      vknTckn: '11111111111',
      adi: '',
      soyadi: '',
      unvan: 'TAHAKKUK PROBE A.Ş.',
      bulvarCaddeSokak: '',
      binaAdi: '',
      binaNo: '',
      kapiNo: '',
      kasabaKoy: '',
      mahalleSemtIlce: '',
      sehir: 'İstanbul',
      postaKodu: '',
      ulke: 'Türkiye',
      paraBirimi: 'TRY',
      kur: 0,
      serbestTable: [
        {
          neIcinAlindigi: 'Mimarlık',
          brutUcret: 500,
          stopaj: 20,
          netUcret: 0,
          kdv: 20,
          kdvTevkifatOrani: 0,
          netAlinan: 0,
        },
      ],
      aciklama: '',
      brtUcret: 500,
      gvStpjTtari: 100,
      netUcretTtr: 400,
      kdvTtri: 100,
      kdvTvkftTtri: 0,
      thsilEdilenKdv: 100,
      netAlinanToplam: 500,
      kdvTahakkukIcin: true,
      vergiDairesi: '',
      hata: '',
    },
    metadata: { optime: '20260905193958+0300' },
  },
  /**
   * `EARSIV_PORTAL_FATURA_GOSTER` geçerli bir SMM ETTN'i ile: sızdırılmış bir
   * Java istisnası. Aynı komut müstahsilde 51 KB HTML döndürüyor.
   */
  selfEmployedReceiptShowBroken: {
    error: '1',
    messages: ['String index out of range: 4'],
    metadata: { optime: '20260905193854+0300' },
  },
  /**
   * `EARSIV_PORTAL_FATURA_SIL` — test portalında HER belge türü için
   * başarısız (fatura dahil). Makbuzlara özgü DEĞİL, önceden var olan bir
   * portal davranışı.
   */
  draftDeleteFailed: {
    data: 'Silinirken bir sorun oluştu.',
    metadata: { optime: '20260905193854+0300' },
  },
  disputePrecondition: {
    data: 'Bu belge iptal talebi oluşturmak için gerekli koşulları sağlamıyor! Onaylı olduğundan ve daha önce ilgili belge için herhangi bir talepte bulunulmadığından emin olun.',
    metadata: { optime: '20260903200049+0300' },
  },
} as const
