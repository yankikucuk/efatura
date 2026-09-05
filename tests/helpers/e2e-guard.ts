/** E2E testleri yalnızca EFATURA_E2E=1 iken çalışır. */
export const isE2eEnabled = (): boolean => process.env.EFATURA_E2E === '1'

/** Paylaşımlı test kullanıcısında kayıtları ayırt etmek için rastgele damga. */
export const uniqueStamp = (): string =>
  `E2E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
