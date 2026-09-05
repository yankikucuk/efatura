/**
 * VKN/TCKN biçim doğrulaması (`documents` yaprak katmanı).
 *
 * Bu kontrol ÜÇ belge türünün ORTAK kapısıdır: fatura, müstahsil makbuzu ve
 * serbest meslek makbuzu aynı `vknTckn` alanını kullanır. Portal geçersiz bir
 * kimlik numarasına "Form parametrelerinde sorun var" gibi teşhis edilemeyen
 * bir metinle karşılık veriyor — hangi alanın bozuk olduğunu söylemiyor — bu
 * yüzden istek AĞA ÇIKMADAN burada reddedilir.
 *
 * Doğrulama bilinçli olarak BİÇİMSELDİR (uzunluk + yalnızca rakam) ve TCKN'nin
 * kendi sağlama algoritmasını çalıştırmaz: portalın kabul ettiği ve nihai
 * tüketici faturalarında zorunlu olan 11111111111 o algoritmayı geçmez.
 */

import { describe, expect, it } from 'vitest'

import { isValidTaxOrIdentityNumber } from './identity.js'

describe('isValidTaxOrIdentityNumber (documents katmanına taşındı)', () => {
  // Kapsam: iki geçerli uzunluk (VKN 10 / TCKN 11) ve reddedilen biçimler.
  // Fonksiyon `invoice` modülünden buraya taşındı; `invoice` aynı adı geriye
  // dönük uyumluluk için yeniden dışa açıyor. Bu süit taşınan ASIL
  // uygulamayı sınar, takma adın aynı davrandığı ise
  // invoice.validator.test.ts'te ayrıca pinlenir.
  it('10 haneli VKN ve 11 haneli TCKN kabul eder', () => {
    expect(isValidTaxOrIdentityNumber('1234567890')).toBe(true)
    expect(isValidTaxOrIdentityNumber('11111111111')).toBe(true)
  })

  it('yanlış uzunluk ve rakam dışı karakter reddeder', () => {
    expect(isValidTaxOrIdentityNumber('123')).toBe(false)
    expect(isValidTaxOrIdentityNumber('123456789012')).toBe(false)
    expect(isValidTaxOrIdentityNumber('1234ABC890')).toBe(false)
    expect(isValidTaxOrIdentityNumber('')).toBe(false)
  })
})
