import { PRODUCER_RECEIPT_TAX_CODES } from '../../constants/index.js'
import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'
import { isValidTaxOrIdentityNumber } from '../../documents/index.js'

import { PRODUCER_RECEIPT_TAX_KEYS } from './producer-receipt.totals.js'
import type { ProducerReceiptInput } from './producer-receipt.types.js'

/**
 * Müstahsil makbuzunu portala göndermeden önce doğrular.
 *
 * Portal makbuz tutarlarını ve alanlarını DOĞRULAMIYOR (canlı doğrulandı:
 * aritmetik olarak yanlış bir `odenecekTutar` sessizce saklandı, adı boş bir
 * müstahsil kabul edildi). Yani bu doğrulayıcı "portalın da yapacağı" bir
 * kontrolün kopyası değil, TEK kontroldür.
 *
 * Tüm sorunlar toplanır; ilk hatada durulmaz.
 */
export function validateProducerReceiptInput(input: ProducerReceiptInput): void {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string): void => {
    issues.push({ path, message })
  }

  const { producer } = input
  if (!isValidTaxOrIdentityNumber(producer.taxOrIdentityNumber)) {
    add(
      'producer.taxOrIdentityNumber',
      'VKN 10 haneli, TCKN 11 haneli ve yalnızca rakamlardan oluşmalı.',
    )
  }

  // Müstahsil makbuzunda `unvan` alanı YOKTUR; belge yalnızca gerçek kişiye
  // kesilir ve adsız bir makbuz hukuken geçersizdir. Portal boş adı kabul
  // ediyor, biz etmiyoruz.
  const hasName =
    (producer.firstName ?? '').trim().length > 0 || (producer.lastName ?? '').trim().length > 0
  if (!hasName) {
    add('producer', 'Müstahsilin adı veya soyadı verilmeli.')
  }

  if (input.lineItems.length === 0) {
    add('lineItems', 'Makbuz en az bir kalem içermeli.')
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
    for (const code of PRODUCER_RECEIPT_TAX_CODES) {
      const key = PRODUCER_RECEIPT_TAX_KEYS[code]
      const rate = item.taxRates?.[key] ?? 0
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        // Yol alanı kesintinin ADINI taşır: aşağı akıştaki applyPercent
        // yalnızca "oran" diyebiliyor ve dört kesintiden hangisinin bozuk
        // olduğunu söyleyemiyordu.
        add(at(`taxRates.${key}`), 'Kesinti oranı 0 ile 100 arasında bir yüzde olmalı.')
      }
    }
  })

  if (issues.length > 0) {
    throw new EArsivValidationError(
      `Müstahsil makbuzu doğrulama başarısız: ${issues.map((issue) => issue.message).join(' | ')}`,
      issues,
    )
  }
}
