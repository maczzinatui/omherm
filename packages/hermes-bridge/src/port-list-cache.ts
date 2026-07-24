/**
 * Tiny TTL cache for expensive `hermes * list` CLI reads.
 * Mutations must call invalidate* so enable/disable never serve stale inventory.
 */

export type CacheEntry<T> = {
	value: T
	expiresAt: number
}

export function createTtlCache<T>(ttlMs: number) {
	const map = new Map<string, CacheEntry<T>>()
	return {
		get(key: string): T | undefined {
			const e = map.get(key)
			if (!e) return undefined
			if (Date.now() > e.expiresAt) {
				map.delete(key)
				return undefined
			}
			return e.value
		},
		set(key: string, value: T): void {
			map.set(key, { value, expiresAt: Date.now() + ttlMs })
		},
		invalidate(prefix?: string): void {
			if (prefix == null) {
				map.clear()
				return
			}
			for (const k of map.keys()) {
				if (k === prefix || k.startsWith(prefix)) map.delete(k)
			}
		},
		/** Test / metrics */
		size(): number {
			return map.size
		},
	}
}

/** Default: open/close inventory twice within a short window should not re-spawn CLI. */
export const PORT_LIST_TTL_MS = 8_000
