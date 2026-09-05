import { describe, expect, it } from 'vitest'

import { DisputeAnswer, DisputeMethod } from '../../constants/index.js'
import { EArsivValidationError } from '../../core/index.js'

import {
  validateCancellationRequest,
  validateDisputeResponse,
  validateObjectionRequest,
} from './dispute.validator.js'

describe('validateCancellationRequest', () => {
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
      validateObjectionRequest({ ...valid, referenceDocumentDate: '' as unknown as string })
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

describe('validateDisputeResponse', () => {
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
