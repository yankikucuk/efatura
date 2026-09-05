import type { Logger } from './logger.types.js'

const ignore = (): void => undefined

/** Varsayılan logger: hiçbir şey yapmaz. Kütüphane sessiz olmalıdır. */
export const noopLogger: Logger = { debug: ignore, info: ignore, warn: ignore, error: ignore }
