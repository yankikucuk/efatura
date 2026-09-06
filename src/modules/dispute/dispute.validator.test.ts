/**
 * İptal ve itiraz taleplerinin girdi doğrulaması.
 *
 * Bu talepler geri alınamaz ve her belge için EN FAZLA BİR KEZ açılabilir;
 * eksik alanla gönderilen bir talep o tek şansın harcanmasına yol açabilir. Bu
 * yüzden doğrulama ağa çıkmadan yapılır.
 *
 * Süitin ayırt ettiği asıl şey İKİ FARKLI itiraz yüküdür:
 * - `validateObjectionRequest` — KENDİ düzenlediğiniz belgeye itiraz; yedi
 *   alan. Nadir senaryo.
 * - `validateIncomingObjectionRequest` — ADINIZA düzenlenmiş belgeye itiraz;
 *   aynı yedi alan + `invoiceOid`, `totalAmount`, `sellerTaxOrIdentityNumber`
 *   ve `documentNumber`. Bu dört alan liste satırından okunur; eksikleri
 *   portalda "Bu işlem için yetkiniz yok" gibi tamamen yanıltıcı bir metinle
 *   geri gelir, yani yerelde yakalanmazsa teşhis edilemez.
 */

import { describe, expect, it } from 'vitest'

import { DisputeAnswer, DisputeMethod } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import {
  validateCancellationRequest,
  validateDisputeResponse,
  validateIncomingObjectionRequest,
  validateObjectionRequest,
} from './dispute.validator.js'

describe('validateCancellationRequest', () => {
  // Kapsam: ETTN ve gerekçenin zorunluluğu (yalnızca boşluktan oluşan gerekçe
  // dahil).
  it('gerekçe ile geçer', () => {
    expect(() => {
      validateCancellationRequest({ ettn: 'a', reason: 'Yanlış tutar' })
    }).not.toThrow()
  })

  it('boş gerekçeyi reddeder', () => {
    expect(() => {
      validateCancellationRequest({ ettn: 'a', reason: '   ' })
    }).toThrow(EArsivValidationError)
  })

  it('boş ETTN reddeder', () => {
    expect(() => {
      validateCancellationRequest({ ettn: '', reason: 'gerekçe' })
    }).toThrow(EArsivValidationError)
  })
})

describe('validateObjectionRequest', () => {
  // Kapsam: yedi alanlı temel itiraz girdisi; eksikler tek seferde toplanır.
  const valid = {
    ettn: 'a',
    method: DisputeMethod.KEP,
    referenceDocumentId: '2026/1',
    referenceDocumentDate: '03/09/2026',
    reason: 'İtiraz gerekçesi',
  }

  it('tam girdi ile geçer', () => {
    expect(() => {
      validateObjectionRequest(valid)
    }).not.toThrow()
  })

  it('referans belge numarası zorunludur', () => {
    expect(() => {
      validateObjectionRequest({ ...valid, referenceDocumentId: '' })
    }).toThrow(/belge sayısı|belge numarası/i)
  })

  it('referans belge tarihi zorunludur', () => {
    expect(() => {
      validateObjectionRequest({ ...valid, referenceDocumentDate: '' })
    }).toThrow(EArsivValidationError)
  })

  it('gerekçe zorunludur', () => {
    expect(() => {
      validateObjectionRequest({ ...valid, reason: '' })
    }).toThrow(EArsivValidationError)
  })

  it('tüm eksikleri tek seferde toplar', () => {
    try {
      validateObjectionRequest({ ...valid, referenceDocumentId: '', reason: '' })
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues.length).toBe(2)
    }
  })
})

describe('validateIncomingObjectionRequest', () => {
  // Kapsam: temel yedi alan + liste satırından okunan dört ek alan. Sayısal
  // `totalAmount` ayrıca sonluluk ve işaret açısından denetlenir.
  const valid = {
    ettn: 'a',
    method: DisputeMethod.KEP,
    referenceDocumentId: '2026/1',
    referenceDocumentDate: '03/09/2026',
    reason: 'İtiraz gerekçesi',
    invoiceOid: '999',
    totalAmount: 120,
    sellerTaxOrIdentityNumber: '9999999999',
    documentNumber: 'GIB123',
  }

  it('tam girdi (11 alan) ile geçer', () => {
    expect(() => {
      validateIncomingObjectionRequest(valid)
    }).not.toThrow()
  })

  it('invoiceOid zorunludur', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, invoiceOid: '' })
    }).toThrow(/invoiceOid|portal içi kayıt/i)
  })

  it('sellerTaxOrIdentityNumber zorunludur', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, sellerTaxOrIdentityNumber: '' })
    }).toThrow(/satıcı/i)
  })

  it('documentNumber zorunludur', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, documentNumber: '' })
    }).toThrow(/belge numarası/i)
  })

  it('totalAmount sonlu bir sayı olmalı', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, totalAmount: Number.NaN })
    }).toThrow(/tutar/i)
  })

  it('negatif totalAmount reddedilir', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, totalAmount: -1 })
    }).toThrow(/tutar/i)
  })

  it('temel yedi alanın doğrulaması da uygulanır (gerekçe boş)', () => {
    expect(() => {
      validateIncomingObjectionRequest({ ...valid, reason: '' })
    }).toThrow(EArsivValidationError)
  })

  it('tüm eksikleri tek seferde toplar', () => {
    try {
      validateIncomingObjectionRequest({
        ...valid,
        invoiceOid: '',
        sellerTaxOrIdentityNumber: '',
        documentNumber: '',
        reason: '',
      })
      expect.unreachable('hata bekleniyordu')
    } catch (error) {
      expect((error as EArsivValidationError).issues.length).toBe(4)
    }
  })
})

describe('validateDisputeResponse', () => {
  // Kapsam: cevap tipine göre ASİMETRİK gerekçe kuralı — kabul gerekçe
  // istemez, ret ister.
  it('kabul cevabı gerekçe istemez', () => {
    expect(() => {
      validateDisputeResponse({ disputeId: '1', answer: DisputeAnswer.ACCEPT })
    }).not.toThrow()
  })

  it('ret cevabı gerekçe ister', () => {
    expect(() => {
      validateDisputeResponse({ disputeId: '1', answer: DisputeAnswer.REJECT })
    }).toThrow(/ret gerekçe/i)
  })

  it('gerekçeli ret geçer', () => {
    expect(() => {
      validateDisputeResponse({
        disputeId: '1',
        answer: DisputeAnswer.REJECT,
        rejectionReason: 'Talep haksız',
      })
    }).not.toThrow()
  })
})
