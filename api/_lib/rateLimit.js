// Tiny fixed-window rate limiter kept in module memory.
//
// SCOPE — READ THIS BEFORE TRUSTING IT.
//
// This map lives in the memory of one Node process. On Vercel every serverless
// instance has its own isolated memory and instances are continuously created and
// recycled, so this limiter is PER-INSTANCE, not global. The effective ceiling is
// roughly (instances x limit), and a cold start starts every bucket empty.
//
// So this is a guard against one runaway client or an accidental retry loop
// burning the Gemini budget on a single instance. It is not a quota, not a
// security boundary, and must not be described as distributed. A genuinely global
// limit needs shared state (Redis/Upstash, or a Firestore transaction); neither is
// in this project and both add a dependency and a running cost, so the
// architecture deliberately stays dependency-free.
//
// It fails OPEN. If the bookkeeping ever throws, the request is allowed, so a bug
// in here can never be the reason a legitimate user loses access to the AI
// features. The endpoints stay authenticated and the Gemini key stays server-side
// either way, so failing open does not widen who can spend the budget.

const DEFAULT_WINDOW_MS = 60 * 1000
const DEFAULT_LIMIT = 20

// Upper bound on tracked identities. Keys are verified Firebase uids rather than
// anything a caller can choose, so this is generous for real traffic; the cap only
// exists so a burst of distinct keys cannot grow the map without bound between
// sweeps.
const MAX_BUCKETS = 10000

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map()
let lastSweep = Date.now()

// Expired windows are pure memory, so dropping them is all that cleanup requires.
function sweep(now) {
  if (now - lastSweep < DEFAULT_WINDOW_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

// Called only when a new key is about to be inserted, which keeps the hot path
// O(1). Drops whichever window expires soonest: already the least useful entry.
function evictIfNeeded() {
  if (buckets.size < MAX_BUCKETS) return
  let oldestKey = null
  let oldestResetAt = Infinity
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < oldestResetAt) {
      oldestResetAt = bucket.resetAt
      oldestKey = key
    }
  }
  if (oldestKey !== null) buckets.delete(oldestKey)
}

/**
 * Consumes one token for `key` and reports whether the caller is still allowed.
 *
 * @param {string} key Identity the limit is applied to (normally a user uid).
 * @param {{ limit?: number, windowMs?: number }} [options]
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }}
 */
export function consumeRateLimit(key, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : DEFAULT_LIMIT
  const windowMs = Number.isFinite(options.windowMs) ? options.windowMs : DEFAULT_WINDOW_MS
  const now = Date.now()

  try {
    sweep(now)

    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      evictIfNeeded()
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

    if (bucket.count > limit) {
      return { allowed: false, remaining: 0, retryAfterSeconds }
    }

    return { allowed: true, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds }
  } catch {
    return { allowed: true, remaining: 0, retryAfterSeconds: 0 }
  }
}