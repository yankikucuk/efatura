import { EArsivValidationError, type Logger, noopLogger } from '../core/index.js'

import { BASE_URLS, type EnvironmentName } from './environment.js'

/**
 * Portal boş veya otomasyon kokan bir User-Agent ile gelen istekleri
 * reddedebiliyor; masaüstü tarayıcı dizesi varsayılan olarak gönderilir.
 */
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface RetryOptions {
  /** Toplam deneme sayısı (ilk istek dahil). En az 1. */
  attempts?: number
  /** İlk yeniden denemeden önceki bekleme; her denemede ikiye katlanır. */
  backoffMs?: number
}

export interface ClientOptions {
  environment?: EnvironmentName
  timeoutMs?: number
  retry?: RetryOptions
  logger?: Logger
  userAgent?: string
  /** Test ve özel ağ katmanları için enjekte edilebilir fetch. */
  fetch?: typeof globalThis.fetch
}

export interface ResolvedClientOptions {
  environment: EnvironmentName
  baseUrl: string
  timeoutMs: number
  retry: { attempts: number; backoffMs: number }
  logger: Logger
  userAgent: string
  fetch: typeof globalThis.fetch
}

function fail(message: string, path: string): never {
  throw new EArsivValidationError(message, [{ path, message }])
}

/** Kullanıcı seçeneklerini varsayılanlarla birleştirir ve doğrular. */
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
