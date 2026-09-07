export function redact(text: string): string {
  return text
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization|cookie)\s*["']?\s*[:=]\s*)(["'])(.*?)\2/gi, '$1$2[REDACTED]$2')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/(Bearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization|cookie)\s*["']?\s*[:=]\s*["']?)[^\s"'&,;}]+/gi, '$1[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
}
export function clean<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as T
  if (Array.isArray(value)) return value.map(clean) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /^(api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization|cookie)$/i.test(key) ? '[REDACTED]' : clean(item)])) as T
  return value
}
