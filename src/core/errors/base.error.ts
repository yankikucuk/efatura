/** Kütüphanenin fırlattığı tüm hataların ortak tabanı. */
export abstract class EArsivError extends Error {
  /** Hatanın makine tarafından ayırt edilebilir türü. */
  abstract readonly kind: string

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
  }
}
