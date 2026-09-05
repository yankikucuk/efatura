export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Yapısal ek bağlam; hassas veri (token, şifre) buraya konmaz. */
export type LogContext = Record<string, unknown>

/** Kütüphanenin dışarıya bağımlı olmayan minimal günlükleme sözleşmesi. */
export type Logger = Record<LogLevel, (message: string, context?: LogContext) => void>
