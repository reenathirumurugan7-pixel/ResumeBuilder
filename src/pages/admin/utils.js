// Small shared pieces used by the admin pages. Pure formatting + presentational
// helpers only; no data access lives here.

export function relativeTime(millis) {
  if (!millis) return '—'
  const diff = Date.now() - millis
  if (diff < 0) return 'Just now'
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return new Date(millis).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function shortUid(uid) {
  if (!uid || typeof uid !== 'string') return '—'
  if (uid.length <= 12) return uid
  return `${uid.slice(0, 8)}…${uid.slice(-4)}`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const millis = typeof value.toMillis === 'function' ? value.toMillis() : new Date(value).getTime()
  if (!Number.isFinite(millis)) return '—'
  return new Date(millis).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}