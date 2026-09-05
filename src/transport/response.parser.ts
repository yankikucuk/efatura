import {
  type CommandName,
  DOCUMENT_COMMANDS,
  FAILURE_MARKERS,
  SUCCESS_PATTERNS,
} from '../constants/index.js'
import { EArsivApiError } from '../core/index.js'

/**
 * `parsePortalResponse` çağrısının bağlamı. Hata fırlatılırsa bu iki alan
 * `EArsivApiError` üzerine aynen taşınır.
 *
 * @example
 * ```ts
 * import { Command } from '@yankikucuk/efatura'
 * import type { ParseContext } from '@yankikucuk/efatura'
 *
 * const context: ParseContext = { command: Command.GET_INVOICE, callId: 'istek-1' }
 * console.log(context.command)
 * ```
 */
export interface ParseContext {
  /** Portala gönderilen `cmd`; başarı/başarısızlık sezgisi buna göre seçilir. */
  command: CommandName
  /** İsteğin `callid` korelasyon kimliği; hata nesnesine aynen aktarılır. */
  callId: string
}

/** `... Hata kodu: 2-1109` kalıbından kodu çeker. */
const ERROR_CODE = /Hata kodu:\s*([\w-]+)/

/**
 * Layer 2 (savunma): `DOCUMENT_COMMANDS`e kaydedilmeyi UNUTAN gelecekteki bir
 * komut, belge gövdesini yine de durum mesajı sanıp taramaya sokmamalı. İki
 * bağımsız işaret kullanılır:
 *
 * - `<` ile başlama: gerçek bir portal durum mesajı HTML/XML biçiminde
 *   gelmez; bu her zaman bir belge gövdesidir.
 * - Uzunluk eşiği: canlı portalda gözlenen durum mesajlarının en uzunu 166
 *   karakterlik `disputePrecondition` metni (bkz.
 *   `tests/fixtures/portal-responses.ts`); görev tanımındaki "~100 karakter"
 *   tahmini fatura oluşturma cümlesine dayanıyordu, ancak gerçek en uzun
 *   örnek 166. Eşik 500 seçildi: en uzun gerçek mesajın ~3 katı — ileride
 *   biraz daha uzun bir durum cümlesi eklenirse eşiği YANLIŞLIKLA
 *   tetiklemeyecek kadar geniş bir pay — ama en küçük gerçek belge
 *   gövdesinden (~47 KB) yüz kat daha küçük, yani gerçek bir belgeyi asla
 *   durum mesajı sanmaz.
 */
const MAX_STATUS_MESSAGE_LENGTH = 500

function looksLikeDocumentPayload(text: string): boolean {
  return text.trimStart().startsWith('<') || text.length > MAX_STATUS_MESSAGE_LENGTH
}

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

/**
 * Bir bayrak alanının GERÇEKTEN "dolu/olumlu" olup olmadığını belirler.
 *
 * `data.hata === ''` kusurunun (aşağıda) üst seviyedeki AYNASI: eski kontrol
 * `payload.error !== undefined && payload.error !== null` idi ve bu yüzden
 * `""`, `"0"`, `0`, `false` gibi portalın BAŞARIDA gönderdiği "boş/sıfır"
 * değerleri de hata sayıyordu (bkz. I6). `Boolean(value)` de yetmez:
 * JavaScript'te `"0"` doğrulanabilir (truthy) bir string'tir ama portal
 * bunu boş bayrakla eşdeğer bir kural olarak kullanıyor.
 */
function isTruthyPortalFlag(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed !== '' && trimmed !== '0'
  }
  return true
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
 *
 * Başarı metni bilinmeyen komutlarda ters yönde çalışılır: metin
 * `FAILURE_MARKERS` işaretlerinden birini taşıyorsa hata sayılır. Belge
 * gövdesi döndüren komutlar (`DOCUMENT_COMMANDS`) bu taramaya HİÇ girmez —
 * 47-55 KB'lık bir fatura HTML'i kullanıcı metni taşır ve kısa durum
 * mesajları için tasarlanmış bir sezgi orada yanlış pozitif üretirdi.
 *
 * @param payload Portalın ham yanıtı — `HttpClient.postForm` çıktısı.
 *   JSON nesnesi değilse doğrudan hata fırlatılır.
 * @param ctx Komut ve `callid`; hangi başarı/başarısızlık kuralının
 *   uygulanacağını komut belirler.
 * @returns Zarfın `data` alanı, ham `unknown` olarak. Tip iddiası çağırana
 *   aittir.
 * @throws {EArsivApiError} Üst seviye `error` bayrağı DOLU ise, `data.hata`
 *   dolu bir stringse veya düz string `data` başarı kuralını sağlamıyorsa.
 *   Hata nesnesi komutu, `callId`'yi, ham yanıtı, varsa `Hata kodu:`
 *   kalıbından ayrıştırılan kodu ve `messages` metinlerini taşır.
 *
 * @example Ham bir yanıtı çözmek
 * ```ts
 * import { Command, EArsivApiError, parsePortalResponse } from '@yankikucuk/efatura'
 *
 * const ok = parsePortalResponse(
 *   { data: { hata: '', belgeNumarasi: 'EAR2026000000123' } },
 *   { command: Command.GET_INVOICE, callId: 'istek-1' },
 * )
 * console.log(ok)
 *
 * try {
 *   parsePortalResponse(
 *     { error: '1', messages: [{ text: 'Bu işlem için yetkiniz yok' }] },
 *     { command: Command.GET_INVOICE, callId: 'istek-2' },
 *   )
 * } catch (error) {
 *   if (error instanceof EArsivApiError) console.error(error.messages)
 * }
 * ```
 */
export function parsePortalResponse(payload: unknown, ctx: ParseContext): unknown {
  if (!isRecord(payload)) {
    throwApi('Portal beklenmeyen bir yanıt döndürdü (JSON nesnesi değil).', payload, ctx)
  }

  if (isTruthyPortalFlag(payload.error)) {
    const messages = collectMessages(payload.messages)
    const detail = messages.length > 0 ? messages.join(' | ') : 'Ayrıntı verilmedi.'
    throwApi(`Portal isteği reddetti: ${detail}`, payload, ctx)
  }

  const data = payload.data

  // DİKKAT: yalnızca DOLU bir `hata` alanı hatadır. Portal başarıda da bu
  // alanı gönderiyor ama boş string olarak (canlı doğrulandı:
  // EARSIV_PORTAL_FATURA_GETIR başarılı yanıtında `data.hata === ''`).
  // Yalnızca `typeof === 'string'` kontrol etmek her başarılı getInvoice
  // çağrısını boş mesajlı bir hataya çevirirdi. Yukarıdaki `payload.error`
  // kontrolü (bkz. I6, `isTruthyPortalFlag`) bunun TAM AYNASI: portal orada
  // da "boş/sıfır" değerleri başarıda gönderiyor.
  if (isRecord(data) && typeof data.hata === 'string' && data.hata.trim() !== '') {
    const text = data.hata
    throwApi(text, payload, ctx, ERROR_CODE.exec(text)?.[1])
  }

  if (typeof data === 'string' && !DOCUMENT_COMMANDS.has(ctx.command)) {
    // DOCUMENT_COMMANDS'ta kayıtlı komutlar (Layer 1) bu bloğa hiç girmez:
    // gövde bir belge, taranacak bir durum mesajı değildir.
    const patterns = SUCCESS_PATTERNS[ctx.command]
    const failed =
      patterns === undefined
        ? // Başarı metnini bilmediğimiz komutlar: hata işaretlerine bakılır —
          // ama önce Layer 2 savunması: gövde belge gibi görünüyorsa
          // (HTML/XML ya da aşırı uzun) tarama hiç yapılmaz.
          !looksLikeDocumentPayload(data) && FAILURE_MARKERS.some((marker) => marker.test(data))
        : // Başarı metnini bildiğimiz komutlar: beyaz liste eşleşmeli.
          !patterns.some((pattern) => data.includes(pattern))
    if (failed) {
      throwApi(data, payload, ctx, ERROR_CODE.exec(data)?.[1])
    }
  }

  return data
}
