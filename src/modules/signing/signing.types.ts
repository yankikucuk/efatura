// eslint-disable-next-line no-restricted-imports -- yalnızca tip import'u, çalışma zamanı bağımlılığı yok
import type { InvoiceSummary } from '../invoice/index.js'

export interface SmsChallenge {
  /** Portalın ürettiği işlem kimliği; doğrulama adımında geri gönderilir. */
  operationId: string
  phoneNumber: string
}

export interface SendSmsOptions {
  /** Verilmezse portaldan kayıtlı numara sorgulanır. */
  phoneNumber?: string
}

export interface VerifySmsInput {
  /** SMS ile gelen doğrulama kodu. */
  code: string
  operationId: string
  /** İmzalanacak faturaların özet satırları. */
  invoices: readonly InvoiceSummary[]
}
