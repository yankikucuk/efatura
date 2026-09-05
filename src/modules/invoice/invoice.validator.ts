import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'

import type { InvoiceInput } from './invoice.types.js'

const DIGITS_ONLY = /^\d+$/

/** VKN 10, TCKN 11 hanedir; portal yalnızca uzunluk ve rakam kontrolü yapar. */
export function isValidTaxOrIdentityNumber(value: string): boolean {
  return DIGITS_ONLY.test(value) && (value.length === 10 || value.length === 11)
}

/**
 * Faturayı portala göndermeden önce doğrular.
 * Tüm sorunlar toplanır; ilk hatada durulmaz, böylece çağıran tek seferde
 * hepsini düzeltebilir.
 */
export function validateInvoiceInput(input: InvoiceInput): void {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string): void => {
    issues.push({ path, message })
  }

  const { buyer } = input
  if (!isValidTaxOrIdentityNumber(buyer.taxOrIdentityNumber)) {
    add(
      'buyer.taxOrIdentityNumber',
      'VKN 10 haneli, TCKN 11 haneli ve yalnızca rakamlardan oluşmalı.',
    )
  }

  const hasTitle = (buyer.title ?? '').trim().length > 0
  const hasName =
    (buyer.firstName ?? '').trim().length > 0 || (buyer.lastName ?? '').trim().length > 0
  if (!hasTitle && !hasName) {
    add('buyer', 'Alıcı için ya ünvan ya da ad/soyad verilmeli.')
  }

  if (input.lineItems.length === 0) {
    add('lineItems', 'Fatura en az bir kalem içermeli.')
  }

  input.lineItems.forEach((item, index) => {
    const at = (field: string): string => `lineItems.${String(index)}.${field}`
    if (item.name.trim().length === 0) add(at('name'), 'Kalem adı boş olamaz.')
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      add(at('quantity'), 'Miktar pozitif bir sayı olmalı.')
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      add(at('unitPrice'), 'Birim fiyat negatif olamaz.')
    }
    if (!Number.isFinite(item.vatRate) || item.vatRate < 0 || item.vatRate > 100) {
      add(at('vatRate'), 'KDV oranı 0 ile 100 arasında bir yüzde olmalı.')
    }
    const discount = item.discountRate ?? 0
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      add(at('discountRate'), 'İskonto oranı 0 ile 100 arasında bir yüzde olmalı.')
    }
  })

  const currency = input.currency ?? 'TRY'
  if (currency !== 'TRY') {
    const rate = input.currencyRate
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
      add('currencyRate', `${currency} para biriminde döviz kuru zorunlu ve pozitif olmalı.`)
    }
  }

  if (issues.length > 0) {
    // Üst seviye mesaj sorunların kendisini taşır. Yalnızca sayı bildirmek
    // (`"3 doğrulama hatası içeriyor"`) `error.message` loglayan çağırana
    // hiçbir şey söylemez ve neyin yanlış olduğunu görmek için issues
    // dizisini açmayı zorunlu kılardı. Biçim parsePortalResponse ile aynı.
    throw new EArsivValidationError(
      `Fatura doğrulama başarısız: ${issues.map((issue) => issue.message).join(' | ')}`,
      issues,
    )
  }
}
