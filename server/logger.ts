/**
 * The app log: one JSON line per event on stdout, with personal data masked. Adapted from infra-mercado's
 * `modelos/logger.ts` (the CPF/CNPJ/e-mail masks), plus what a job search leaks: phone numbers, money amounts
 * (salaries) and whole fields that must never be logged at all (the CV, recruiter messages, transcripts).
 *
 * Use this instead of `console.*` anywhere a value may come from the workspace or a request body.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'
const WEIGHT: Record<Level | 'silent', number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 }

const configured = process.env.LOG_LEVEL as Level | 'silent' | undefined
const threshold = WEIGHT[configured ?? (process.env.VITEST ? 'silent' : 'info')] ?? WEIGHT.info

/** Field names whose value is dropped whole: masking a CV line by line would still leak it. */
const REDACTED_KEYS =
  /^(cv|resume|curriculum|salary|salaryExpectation|pay|compensation|message|messages|body|text|turns|account|notes|password|token|apiKey|authorization)$/i

/** Keeps the start and end of each value: a case can be correlated without exposing the data (LGPD). */
export function maskText(value: string): string {
  return (
    value
      // e-mail: a***@domain.com
      .replace(/\b([\w.+-])[\w.+-]*@([\w-]+\.[\w.-]+)\b/g, '$1***@$2')
      // CPF and CNPJ
      .replace(/(\d{3})\.\d{3}\.\d{3}-(\d{2})/g, '$1.***.***-$2')
      .replace(/(\d{2})\.\d{3}\.\d{3}\/\d{4}-(\d{2})/g, '$1.***.***/****-$2')
      // money: R$ 12.000, $120k, USD 100,000, 15.000,00 BRL, €4,500
      .replace(
        /(?:R\$|US\$|\$|€|£|\b(?:BRL|USD|EUR|GBP)\b)\s?\d[\d.,]*\s?(?:k|mil)?|\b\d[\d.,]*\s?(?:k|mil)?\s?(?:BRL|USD|EUR|GBP|reais)\b/gi,
        '[money]',
      )
      // phone numbers: +55 (11) 91234-5678, (31) 3333-4444, +1 415 555 0100
      .replace(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,5}[\s.-]?\d{4}\b/g, '[phone]')
  )
}

export function maskPII<T>(value: T, key = ''): T {
  if (key && REDACTED_KEYS.test(key) && value !== undefined && value !== null) return '[redacted]' as T
  if (typeof value === 'string') return maskText(value) as T
  if (Array.isArray(value)) return value.map((v) => maskPII(v)) as T
  if (value instanceof Error) return { name: value.name, message: maskText(value.message) } as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskPII(v, k)])) as T
  }
  return value
}

function write(level: Level, message: string, fields: Record<string, unknown> = {}) {
  if (WEIGHT[level] < threshold) return
  const line = maskPII({ timestamp: new Date().toISOString(), level, message, ...fields })
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout
  stream.write(`${JSON.stringify(line)}\n`)
}

export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => write('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
}
