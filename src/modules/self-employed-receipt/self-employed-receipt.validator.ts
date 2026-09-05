import { Currency } from '../../constants/index.js'
import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'
import { isValidTaxOrIdentityNumber } from '../../documents/index.js'

import type { SelfEmployedReceiptInput } from './self-employed-receipt.types.js'

/**
 * Serbest meslek makbuzunu portala göndermeden önce doğrular.
 *
 * Portal makbuz alanlarını ve tutarlarını DOĞRULAMIYOR (canlı doğrulandı);
 * bu doğrulayıcı bir ikinci kontrol değil, TEK kontroldür. Tüm sorunlar
 * toplanır; ilk hatada durulmaz.
 *
 * @param input Denetlenecek makbuz girdisi.
 * @returns Doğrulama geçerse hiçbir şey (`void`).
 * @throws {EArsivValidationError} `payer.taxOrIdentityNumber` geçersizse;
 *   ünvan ve ad/soyad BİRLİKTE boşsa (müstahsilden FARKLI olarak burada ünvan
 *   tek başına yeterlidir); kalem listesi boşsa; bir kalemin açıklaması
 *   boşsa, brüt ücreti negatifse ya da üç oranından biri [0, 100] dışındaysa;
 *   veya TRY dışı bir para biriminde `currencyRate` verilmemiş/pozitif
 *   değilse.
 *
 * @example
 * ```ts
 * import { Currency, EArsivValidationError, validateSelfEmployedReceiptInput } from 'efatura'
 *
 * try {
 *   validateSelfEmployedReceiptInput({
 *     currency: Currency.EURO, // kur verilmedi
 *     payer: { taxOrIdentityNumber: '1111111111', title: 'ÖRNEK A.Ş.' },
 *     lineItems: [{ description: 'Danışmanlık', grossFee: 1_000, vatRate: 20 }],
 *   })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues[0]?.path)
 *   // 'currencyRate'
 * }
 * ```
 */
export function validateSelfEmployedReceiptInput(input: SelfEmployedReceiptInput): void {
  const issues: ValidationIssue[] = []
  const add = (path: string, message: string): void => {
    issues.push({ path, message })
  }

  const { payer } = input
  if (!isValidTaxOrIdentityNumber(payer.taxOrIdentityNumber)) {
    add(
      'payer.taxOrIdentityNumber',
      'VKN 10 haneli, TCKN 11 haneli ve yalnızca rakamlardan oluşmalı.',
    )
  }

  // Müstahsil makbuzundan FARKLI olarak burada `unvan` alanı vardır ve
  // makbuz tüzel kişiye de düzenlenebilir.
  const hasTitle = (payer.title ?? '').trim().length > 0
  const hasName =
    (payer.firstName ?? '').trim().length > 0 || (payer.lastName ?? '').trim().length > 0
  if (!hasTitle && !hasName) {
    add('payer', 'Makbuzun düzenlendiği taraf için ya ünvan ya da ad/soyad verilmeli.')
  }

  if (input.lineItems.length === 0) {
    add('lineItems', 'Makbuz en az bir kalem içermeli.')
  }

  input.lineItems.forEach((item, index) => {
    const at = (field: string): string => `lineItems.${String(index)}.${field}`
    if (item.description.trim().length === 0) {
      add(at('description'), 'Ücretin ne için alındığı boş olamaz.')
    }
    if (!Number.isFinite(item.grossFee) || item.grossFee < 0) {
      add(at('grossFee'), 'Brüt ücret negatif olmayan bir sayı olmalı.')
    }
    const rates: [string, number][] = [
      ['vatRate', item.vatRate],
      ['withholdingRate', item.withholdingRate ?? 0],
      ['vatWithholdingRate', item.vatWithholdingRate ?? 0],
    ]
    for (const [field, rate] of rates) {
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        add(at(field), 'Oran 0 ile 100 arasında bir yüzde olmalı.')
      }
    }
  })

  const currency = input.currency ?? Currency.TURKISH_LIRA
  if (currency !== Currency.TURKISH_LIRA) {
    const rate = input.currencyRate
    if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
      add('currencyRate', `${currency} para biriminde döviz kuru zorunlu ve pozitif olmalı.`)
    }
  }

  if (issues.length > 0) {
    throw new EArsivValidationError(
      `Serbest meslek makbuzu doğrulama başarısız: ${issues.map((issue) => issue.message).join(' | ')}`,
      issues,
    )
  }
}
