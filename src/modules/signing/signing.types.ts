// import-x/no-restricted-paths istisnası: yalnızca tip import'u, çalışma zamanı bağımlılığı yok.
// (Bu satırda `eslint-disable-next-line` kullanılmadı: kural bu importu hiç yakalamıyor —
// bkz. görev raporu — ve gerçek bir uyarı bastırmayan directive, pre-commit `eslint --fix`
// tarafından "unused directive" olarak otomatik siliniyor.)
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
