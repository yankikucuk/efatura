import { describe, expect, it } from 'vitest'

import {
  ApprovalStatus,
  Currency,
  DisputeAnswer,
  DisputeMethod,
  DisputeStatus,
  DocumentType,
  InvoiceListKind,
  InvoiceType,
  Unit,
} from './index.js'

describe('sabitler', () => {
  it('para birimi kodları ISO 4217', () => {
    expect(Currency.TURKISH_LIRA).toBe('TRY')
    expect(Currency.US_DOLLAR).toBe('USD')
    expect(Currency.EURO).toBe('EUR')
  })

  it('birim kodları UN/ECE Recommendation 20', () => {
    expect(Unit.PIECE).toBe('C62')
    expect(Unit.KILOGRAM).toBe('KGM')
    expect(Unit.DAY).toBe('DAY')
    expect(Unit.HOUR).toBe('HUR')
  })

  it('fatura tipleri portal değerleridir', () => {
    expect(InvoiceType.SALE).toBe('SATIS')
    expect(InvoiceType.REFUND).toBe('IADE')
    expect(InvoiceType.WITHHOLDING).toBe('TEVKIFAT')
    expect(InvoiceType.EXEMPTION).toBe('ISTISNA')
    expect(InvoiceType.SPECIAL_BASE).toBe('OZELMATRAH')
  })

  it('onay durumu portalın Türkçe metnidir', () => {
    expect(ApprovalStatus.APPROVED).toBe('Onaylandı')
    expect(ApprovalStatus.NOT_APPROVED).toBe('Onaylanmadı')
  })

  it('liste tipleri iki farklı belge kümesini ayırır', () => {
    expect(InvoiceListKind.INTERACTIVE).toBe('5000/30000')
    expect(InvoiceListKind.STANDARD).toBe('Buyuk')
  })

  it('itiraz yöntemleri portal tanımından gelir', () => {
    expect(DisputeMethod.NOTARY).toBe('NOTER')
    expect(DisputeMethod.REGISTERED_MAIL).toBe('TAAHHUTLU_MEKTUP')
    expect(DisputeMethod.TELEGRAM).toBe('TELGRAF')
    expect(DisputeMethod.KEP).toBe('KEP')
  })

  it('talep cevabı ve durumu string sayı kodlarıdır', () => {
    expect(DisputeAnswer.ACCEPT).toBe('1')
    expect(DisputeAnswer.REJECT).toBe('2')
    expect(DisputeStatus.CREATED).toBe('0')
    expect(DisputeStatus.ACCEPTED).toBe('1')
    expect(DisputeStatus.REJECTED).toBe('2')
    expect(DisputeStatus.CANCELLED).toBe('3')
  })

  it('belge türü', () => {
    expect(DocumentType.INVOICE).toBe('FATURA')
  })
})
