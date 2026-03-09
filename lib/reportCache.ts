interface CacheEntry {
  data: any
  expiresAt: number
  generatedAt: string
}

const cache = new Map<string, CacheEntry>()

const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
const LONG_TTL = 30 * 60 * 1000   // 30 minutes for "all time" queries

export function getCached(key: string): { data: any; generatedAt: string } | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return { data: entry.data, generatedAt: entry.generatedAt }
}

export function setCached(key: string, data: any, ttlMs?: number): string {
  const generatedAt = new Date().toISOString()
  cache.set(key, {
    data,
    expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL),
    generatedAt,
  })
  return generatedAt
}

export { DEFAULT_TTL, LONG_TTL }
