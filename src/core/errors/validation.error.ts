import { EArsivError } from './base.error.js'

export interface ValidationIssue {
  /** Sorunlu alanın nokta ile ayrılmış yolu, ör. "lineItems.0.vatRate". */
  path: string
  message: string
}

/** İstek portala gönderilmeden önce yakalanan yerel doğrulama hatası. */
export class EArsivValidationError extends EArsivError {
  readonly kind = 'validation'
  readonly issues: readonly ValidationIssue[]

  constructor(message: string, issues: readonly ValidationIssue[]) {
    super(message)
    this.issues = issues
  }
}
