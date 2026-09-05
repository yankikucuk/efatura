import type { Logger } from './logger.types.js'

const ignore = (): void => undefined

/**
 * Varsayılan logger: hiçbir şey yapmaz. Kütüphane sessiz olmalıdır.
 *
 * `ClientOptions.logger` verilmediğinde bu kullanılır. Dört seviyenin dördü de
 * çağrılabilir ve hiçbiri fırlatmaz.
 *
 * @example Günlüklemeyi açıkça kapatmak
 * ```ts
 * import { EArsivClient, noopLogger } from 'efatura'
 *
 * const client = new EArsivClient({ environment: 'test', logger: noopLogger })
 * noopLogger.info('bu mesaj hiçbir yere gitmez')
 * console.log(client.environment)
 * ```
 */
export const noopLogger: Logger = { debug: ignore, info: ignore, warn: ignore, error: ignore }
