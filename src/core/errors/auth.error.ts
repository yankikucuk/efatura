import { EArsivError } from './base.error.js'

/** Token yok, süresi dolmuş veya giriş reddedildi. */
export class EArsivAuthError extends EArsivError {
  readonly kind = 'auth'
}
