import { EArsivError } from './base.error.js'

/**
 * Tek bir doğrulama sorunu: hangi alanda, ne yanlış.
 *
 * @example
 * ```ts
 * import type { ValidationIssue } from '@yankikucuk/efatura'
 *
 * const issue: ValidationIssue = {
 *   path: 'lineItems.0.vatRate',
 *   message: 'KDV oranı 0 ile 100 arasında bir yüzde olmalı.',
 * }
 * console.log(issue.path)
 * ```
 */
export interface ValidationIssue {
  /** Sorunlu alanın nokta ile ayrılmış yolu, ör. "lineItems.0.vatRate". */
  path: string
  /** Sorunun Türkçe açıklaması; doğrudan kullanıcıya gösterilebilir. */
  message: string
}

/**
 * İstek portala gönderilmeden önce yakalanan yerel doğrulama hatası.
 *
 * Bu hata fırladığında AĞA HİÇ ÇIKILMAMIŞTIR; portalda hiçbir şey oluşmaz.
 * Doğrulayıcılar ilk hatada durmaz: tüm sorunlar toplanır ve `issues`
 * dizisinde birlikte verilir, böylece çağıran tek seferde hepsini
 * düzeltebilir. `message` alanı da sorunların metinlerini içerir — yalnızca
 * `error.message` günlükleyen bir çağıran neyin yanlış olduğunu görür.
 *
 * Aynı sınıf, `puppeteer` kurulu olmadığında PDF üretiminde de kullanılır.
 *
 * @example Alan bazında hata göstermek
 * ```ts
 * import { EArsivClient, EArsivValidationError, Unit } from '@yankikucuk/efatura'
 *
 * const client = new EArsivClient({ environment: 'test' })
 *
 * try {
 *   await client.createDraft({
 *     // VKN 10 veya TCKN 11 hane olmalı; bu değer geçersiz.
 *     buyer: { taxOrIdentityNumber: '123', title: 'ÖRNEK A.Ş.' },
 *     lineItems: [{ name: '', quantity: 0, unit: Unit.PIECE, unitPrice: -1, vatRate: 150 }],
 *   })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) {
 *     for (const issue of error.issues) console.error(`${issue.path}: ${issue.message}`)
 *   }
 * }
 * ```
 */
export class EArsivValidationError extends EArsivError {
  /** Her zaman `'validation'`. */
  readonly kind = 'validation'
  /** Bulunan tüm sorunlar; en az bir eleman içerir. */
  readonly issues: readonly ValidationIssue[]

  /**
   * @param message Üst seviye hata metni; sorunların kendisini de içerir.
   * @param issues Bulunan sorunların tamamı — ilk hatada durulmaz.
   */
  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message)
    this.issues = issues
  }
}
