import { Currency } from '../../constants/index.js'
import { EArsivValidationError, type ValidationIssue } from '../../core/index.js'
import { isValidTaxOrIdentityNumber } from '../../documents/index.js'

import type { InvoiceInput } from './invoice.types.js'

/**
 * VKN/TCKN kontrolü `documents` yaprak katmanına taşındı (makbuzlar da aynı
 * `vknTckn` alanını kullanıyor); adı geriye dönük uyumluluk için buradan
 * yeniden dışa açılıyor — `invoice/index.ts` üzerinden public API'nin
 * parçası.
 */
export { isValidTaxOrIdentityNumber }

/**
 * Faturayı portala göndermeden önce doğrular.
 * Tüm sorunlar toplanır; ilk hatada durulmaz, böylece çağıran tek seferde
 * hepsini düzeltebilir.
 *
 * `InvoiceService.createDraft` bunu kendisi çağırır; doğrudan çağırmanız
 * yalnızca bir formu göndermeden ÖNCE denetlemek isterseniz gerekir.
 * Denetlenenler: alıcının VKN/TCKN'i, ünvan ya da ad/soyaddan en az birinin
 * varlığı, en az bir kalem, her kalemin adı/miktarı/birim fiyatı ve üç oranı,
 * özel matrah alanları ve TRY dışı para biriminde döviz kurunun zorunluluğu.
 *
 * @param input Denetlenecek fatura girdisi.
 * @returns Doğrulama geçerse hiçbir şey (`void`).
 * @throws {EArsivValidationError} En az bir sorun bulunursa. `message`
 *   sorunların METİNLERİNİ de içerir; `issues` her sorunun yolunu taşır
 *   (ör. `lineItems.2.vatRate`).
 *
 * @example
 * ```ts
 * import { EArsivValidationError, Unit, validateInvoiceInput } from '@yankikucuk/efatura'
 *
 * try {
 *   validateInvoiceInput({
 *     buyer: { taxOrIdentityNumber: '123' },
 *     lineItems: [{ name: '', quantity: 0, unit: Unit.PIECE, unitPrice: -1, vatRate: 150 }],
 *   })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) {
 *     console.error(error.issues.map((issue) => issue.path))
 *   }
 * }
 * ```
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
    const additional = item.additionalTaxRate ?? 0
    if (!Number.isFinite(additional) || additional < 0 || additional > 100) {
      add(at('additionalTaxRate'), 'Ek vergi oranı 0 ile 100 arasında bir yüzde olmalı.')
    }
  })

  // Özel matrah alanlarının aşağı akışta hiçbir koruması yok: computeTotals
  // bunlara dokunmuyor, dolayısıyla applyPercent'in aralık kontrolü de
  // devreye girmiyor. Doğrulanmazsa çöp değer doğrudan portala giderdi.
  const specialBase = input.specialBase
  if (specialBase !== undefined) {
    const rate = specialBase.rate ?? 0
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      add('specialBase.rate', 'Özel matrah oranı 0 ile 100 arasında bir yüzde olmalı.')
    }
    for (const field of ['amount', 'taxAmount'] as const) {
      const value = specialBase[field] ?? 0
      if (!Number.isFinite(value) || value < 0) {
        add(`specialBase.${field}`, 'Özel matrah tutarı negatif olmayan bir sayı olmalı.')
      }
    }
  }

  const currency = input.currency ?? Currency.TURKISH_LIRA
  if (currency !== Currency.TURKISH_LIRA) {
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
