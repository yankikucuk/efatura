/**
 * Hata taksonomisi — çağıranın programatik olarak dallanabilmesi.
 *
 * Referans PHP kütüphanesi hata durumunda `die()` çağırıyordu; bu kütüphanenin
 * sözü ise "hiçbir hata yutulmaz". Söz ancak hatalar AYIRT EDİLEBİLİRSE bir işe
 * yarar: geçersiz girdi (`validation`) tekrar denenmez, ağ hatası (`network`)
 * denenebilir, belirsiz sonuç (`ambiguous-result`) kullanıcı kararı ister.
 *
 * Süit her sınıfın (a) `instanceof EArsivError`/`Error` ile yakalanabildiğini,
 * (b) ayırt edici `kind` alanını taşıdığını, (c) teşhis için gereken bağlamı
 * (komut, `callId`, ham yanıt, adaylar, `cause`) KAYBETMEDİĞİNİ sabitler.
 *
 * `name === constructor.name` iddiası önemsiz görünür ama bir bundler sınıf
 * adını küçültürse üretim günlüklerinde hatanın kimliği kaybolur.
 */

import { describe, expect, it } from 'vitest'

import {
  EArsivAmbiguousResultError,
  EArsivApiError,
  EArsivAuthError,
  EArsivError,
  EArsivNetworkError,
  EArsivValidationError,
} from './index.js'

describe('hata sınıfları', () => {
  // Kapsam: beş hata tipinin ORTAK sözleşmesi (miras zinciri, `name`, `kind`)
  // ve her birinin taşıdığı teşhis bağlamı.
  it('tümü EArsivError ve Error alt sınıfıdır', () => {
    const errors = [
      new EArsivApiError('api', { command: 'C', callId: 'id', raw: null }),
      new EArsivAuthError('auth'),
      new EArsivValidationError('doğrulama', [{ path: 'a', message: 'm' }]),
      new EArsivAmbiguousResultError('belirsiz', [1, 2]),
      new EArsivNetworkError('ağ', { url: 'https://x', attempts: 3 }),
    ]
    for (const error of errors) {
      expect(error).toBeInstanceOf(EArsivError)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe(error.constructor.name)
    }
  })

  it('EArsivApiError bağlamı taşır', () => {
    const raw = { data: 'Ettn ya eksik ya boş' }
    const error = new EArsivApiError('Sunucu hatası', {
      command: 'EARSIV_PORTAL_FATURA_OLUSTUR',
      callId: 'abc',
      raw,
      code: '2-1109',
      messages: ['Bu işlem için yetkiniz yok'],
    })
    expect(error.kind).toBe('api')
    expect(error.command).toBe('EARSIV_PORTAL_FATURA_OLUSTUR')
    expect(error.callId).toBe('abc')
    expect(error.raw).toBe(raw)
    expect(error.code).toBe('2-1109')
    expect(error.messages).toEqual(['Bu işlem için yetkiniz yok'])
  })

  it('EArsivValidationError sorunları listeler', () => {
    const error = new EArsivValidationError('geçersiz', [
      { path: 'buyer.taxOrIdentityNumber', message: 'VKN 10 veya TCKN 11 hane olmalı' },
    ])
    expect(error.kind).toBe('validation')
    expect(error.issues).toHaveLength(1)
    expect(error.issues[0]?.path).toBe('buyer.taxOrIdentityNumber')
  })

  it('EArsivAmbiguousResultError adayları taşır', () => {
    const error = new EArsivAmbiguousResultError('iki aday', [{ ettn: 'a' }, { ettn: 'b' }])
    expect(error.kind).toBe('ambiguous-result')
    expect(error.candidates).toHaveLength(2)
  })

  it('cause zincirini korur', () => {
    const cause = new Error('kök neden')
    const error = new EArsivNetworkError('ağ', { url: 'https://x', attempts: 1, cause })
    expect(error.cause).toBe(cause)
    expect(error.attempts).toBe(1)
  })
})
