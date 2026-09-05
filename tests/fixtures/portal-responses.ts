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
  disputePrecondition: {
    data: 'Bu belge iptal talebi oluşturmak için gerekli koşulları sağlamıyor! Onaylı olduğundan ve daha önce ilgili belge için herhangi bir talepte bulunulmadığından emin olun.',
    metadata: { optime: '20260903200049+0300' },
  },
} as const
