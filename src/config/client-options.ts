import { EArsivValidationError, type Logger, noopLogger } from '../core/index.js'

import { BASE_URLS, type EnvironmentName } from './environment.js'

/**
 * Portal boş veya otomasyon kokan bir User-Agent ile gelen istekleri
 * reddedebiliyor; masaüstü tarayıcı dizesi varsayılan olarak gönderilir.
 *
 * `ClientOptions.userAgent` ile değiştirilebilir, ancak portalın hangi
 * dizeleri kabul ettiği belgelenmemiştir — değiştirmeden önce test ortamında
 * doğrulayın.
 *
 * @example
 * ```ts
 * import { DEFAULT_USER_AGENT } from 'efatura'
 *
 * console.log(DEFAULT_USER_AGENT.startsWith('Mozilla/5.0'))
 * ```
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Yeniden deneme ayarları.
 *
 * @example
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { RetryOptions } from 'efatura'
 *
 * // 5 deneme, 1 sn / 2 sn / 4 sn / 8 sn bekleyerek — YALNIZCA salt okunur
 * // komutlar için.
 * const retry: RetryOptions = { attempts: 5, backoffMs: 1_000 }
 * const client = new EArsivClient({ environment: 'test', retry })
 * console.log(client.environment)
 * ```
 */
export interface RetryOptions {
  /**
   * Toplam deneme sayısı (ilk istek dahil). En az 1. Varsayılan 3.
   *
   * YALNIZCA salt okunur komutlar (bkz. `RETRYABLE_COMMANDS`) için geçerlidir.
   * `EARSIV_PORTAL_FATURA_OLUSTUR` gibi bir mutasyon komutu bu değeri
   * GÖRMEZDEN GELİR ve her zaman tam olarak bir kez denenir (bkz. C1) — bir
   * mutasyonu yeniden denemek sunucu isteği zaten işlemişse mükerrer bir
   * hukuki belgeyle (mükerrer fatura, mükerrer imzalama...) sonuçlanabilir.
   * `attempts: 5` verip her mutasyonda da 5 deneme beklemek yaygın bir
   * yanlış varsayımdır.
   */
  attempts?: number
  /** İlk yeniden denemeden önceki bekleme; her denemede ikiye katlanır. Varsayılan 500. */
  backoffMs?: number
}

/**
 * `new EArsivClient(options)` seçenekleri. Tamamı opsiyoneldir.
 *
 * @example Testlerde ağa hiç çıkmayan bir istemci
 * ```ts
 * import { EArsivClient } from 'efatura'
 * import type { ClientOptions } from 'efatura'
 *
 * const options: ClientOptions = {
 *   environment: 'test',
 *   timeoutMs: 5_000,
 *   logger: {
 *     debug: (message) => { console.debug(message) },
 *     info: (message) => { console.info(message) },
 *     warn: (message) => { console.warn(message) },
 *     error: (message) => { console.error(message) },
 *   },
 *   fetch: async () => new Response(JSON.stringify({ data: [] })),
 * }
 * const client = new EArsivClient(options)
 * console.log(client.environment)
 * ```
 */
export interface ClientOptions {
  /** `'production'` (varsayılan) veya `'test'`. Taban adresi belirler. */
  environment?: EnvironmentName
  /** Tek bir isteğin zaman aşımı, milisaniye. Pozitif olmalı; varsayılan 30000. */
  timeoutMs?: number
  /** Yeniden deneme ayarları; yalnızca salt okunur komutları etkiler. */
  retry?: RetryOptions
  /** Günlükleyici; verilmezse hiçbir şey yazmayan `noopLogger` kullanılır. */
  logger?: Logger
  /** Portala gönderilecek `User-Agent`; varsayılan {@link DEFAULT_USER_AGENT}. */
  userAgent?: string
  /** Test ve özel ağ katmanları için enjekte edilebilir fetch. */
  fetch?: typeof globalThis.fetch
}

/**
 * `resolveClientOptions` çıktısı — hiçbir alanı opsiyonel olmayan, doğrulanmış
 * yapılandırma.
 *
 * `HttpClient` ve `AuthService` tek başına kullanılacaksa bu nesne
 * gereklidir; `resolveClientOptions()` ile üretilir, elle kurulmaz.
 *
 * @example
 * ```ts
 * import { HttpClient, resolveClientOptions } from 'efatura'
 * import type { ResolvedClientOptions } from 'efatura'
 *
 * const options: ResolvedClientOptions = resolveClientOptions({ environment: 'test' })
 * const http = new HttpClient(options)
 * console.log(options.baseUrl, typeof http.postForm)
 * ```
 */
export interface ResolvedClientOptions {
  /** Seçilen ortam. */
  environment: EnvironmentName
  /** Ortama karşılık gelen taban adres; `BASE_URLS` üzerinden çözülür. */
  baseUrl: string
  /** Zaman aşımı, milisaniye. */
  timeoutMs: number
  /** Birleştirilmiş yeniden deneme ayarları; iki alan da doludur. */
  retry: { attempts: number; backoffMs: number }
  /** Çözülmüş günlükleyici; verilmediyse `noopLogger`. */
  logger: Logger
  /** Çözülmüş `User-Agent`. */
  userAgent: string
  /** Çözülmüş fetch; verilmediyse `globalThis.fetch`'in bağlanmış hâli. */
  fetch: typeof globalThis.fetch
}

function fail(message: string, path: string): never {
  throw new EArsivValidationError(message, [{ path, message }])
}

/**
 * Kullanıcı seçeneklerini varsayılanlarla birleştirir ve doğrular.
 *
 * `EArsivClient` kurucusu bunu kendisi çağırır; doğrudan çağırmanız yalnızca
 * servisleri (`HttpClient`, `AuthService`, `DocumentService`) tek başına
 * kullanacaksanız gerekir.
 *
 * @param options Kısmi seçenekler; verilmeyen her alan varsayılana düşer:
 *   `environment: 'production'`, `timeoutMs: 30000`,
 *   `retry: { attempts: 3, backoffMs: 500 }`, `logger: noopLogger`,
 *   `userAgent: DEFAULT_USER_AGENT`, `fetch: globalThis.fetch`.
 * @returns Hiçbir alanı opsiyonel olmayan, doğrulanmış yapılandırma —
 *   `baseUrl` dahil.
 * @throws {EArsivValidationError} `environment` bilinmeyen bir değerse,
 *   `timeoutMs` sonlu ve pozitif değilse, `retry.attempts` 1'den küçük ya da
 *   tam sayı değilse veya `retry.backoffMs` negatifse. Hatanın `issues`
 *   dizisi sorunlu alanın yolunu taşır.
 *
 * @example
 * ```ts
 * import { EArsivValidationError, resolveClientOptions } from 'efatura'
 *
 * const resolved = resolveClientOptions({ environment: 'test', retry: { attempts: 5 } })
 * // Kısmi retry varsayılanla birleşir:
 * console.log(resolved.retry) // { attempts: 5, backoffMs: 500 }
 *
 * try {
 *   resolveClientOptions({ timeoutMs: 0 })
 * } catch (error) {
 *   if (error instanceof EArsivValidationError) console.error(error.issues[0]?.path)
 * }
 * ```
 */
export function resolveClientOptions(options: ClientOptions = {}): ResolvedClientOptions {
  const environment = options.environment ?? 'production'
  const baseUrl = BASE_URLS[environment]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (baseUrl === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion
    const errorMessage = `Bilinmeyen ortam: ${String(environment)}. Geçerli değerler: production, test.`
    fail(errorMessage, 'environment')
  }

  const timeoutMs = options.timeoutMs ?? 30_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    fail('timeoutMs pozitif bir sayı olmalı.', 'timeoutMs')
  }

  const attempts = options.retry?.attempts ?? 3
  if (!Number.isInteger(attempts) || attempts < 1) {
    fail('retry.attempts en az 1 olan bir tam sayı olmalı.', 'retry.attempts')
  }

  const backoffMs = options.retry?.backoffMs ?? 500
  if (!Number.isFinite(backoffMs) || backoffMs < 0) {
    fail('retry.backoffMs negatif olmayan bir sayı olmalı.', 'retry.backoffMs')
  }

  return {
    environment,
    baseUrl,
    timeoutMs,
    retry: { attempts, backoffMs },
    logger: options.logger ?? noopLogger,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
  }
}
