import { type CommandName, FAILURE_MARKERS, SUCCESS_PATTERNS } from '../constants/index.js'
import { EArsivApiError } from '../core/index.js'

export interface ParseContext {
  command: CommandName
  callId: string
}

/** `... Hata kodu: 2-1109` kalıbından kodu çeker. */
const ERROR_CODE = /Hata kodu:\s*([\w-]+)/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `messages` alanı hem `{text}` nesneleri hem de düz string içerebiliyor. */
function collectMessages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (isRecord(entry) && typeof entry.text === 'string') return entry.text
      return undefined
    })
    .filter((entry): entry is string => entry !== undefined)
}

function throwApi(message: string, raw: unknown, ctx: ParseContext, code?: string): never {
  throw new EArsivApiError(message, {
    command: ctx.command,
    callId: ctx.callId,
    raw,
    ...(code === undefined ? {} : { code }),
    messages: collectMessages(isRecord(raw) ? raw.messages : undefined),
  })
}

/**
 * Portal zarfını çözer ve `data` alanını döndürür.
 *
 * Portal hataları üç ayrı biçimde bildiriyor ve üçü de HTTP 200 dönüyor:
 * üst seviye `error`, `data.hata` ve düz string `data`. Üçüncüsü sessiz
 * başarısızlığa en açık olanı; bu yüzden string dönen komutlar için beklenen
 * başarı metni `SUCCESS_PATTERNS` üzerinden doğrulanır.
 */
export function parsePortalResponse(payload: unknown, ctx: ParseContext): unknown {
  if (!isRecord(payload)) {
    throwApi('Portal beklenmeyen bir yanıt döndürdü (JSON nesnesi değil).', payload, ctx)
  }

  if (payload.error !== undefined && payload.error !== null) {
    const messages = collectMessages(payload.messages)
    const detail = messages.length > 0 ? messages.join(' | ') : 'Ayrıntı verilmedi.'
    throwApi(`Portal isteği reddetti: ${detail}`, payload, ctx)
  }

  const data = payload.data

  // DİKKAT: yalnızca DOLU bir `hata` alanı hatadır. Portal başarıda da bu
  // alanı gönderiyor ama boş string olarak (canlı doğrulandı:
  // EARSIV_PORTAL_FATURA_GETIR başarılı yanıtında `data.hata === ''`).
  // Yalnızca `typeof === 'string'` kontrol etmek her başarılı getInvoice
  // çağrısını boş mesajlı bir hataya çevirirdi.
  if (isRecord(data) && typeof data.hata === 'string' && data.hata.trim() !== '') {
    const text = data.hata
    throwApi(text, payload, ctx, ERROR_CODE.exec(text)?.[1])
  }

  if (typeof data === 'string') {
    const patterns = SUCCESS_PATTERNS[ctx.command]
    const failed =
      patterns === undefined
        ? // Başarı metnini bilmediğimiz komutlar: hata işaretlerine bakılır.
          FAILURE_MARKERS.some((marker) => marker.test(data))
        : // Başarı metnini bildiğimiz komutlar: beyaz liste eşleşmeli.
          !patterns.some((pattern) => data.includes(pattern))
    if (failed) {
      throwApi(data, payload, ctx, ERROR_CODE.exec(data)?.[1])
    }
  }

  return data
}
