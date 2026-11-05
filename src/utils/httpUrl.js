// Returns a normalised http(s) URL, or null when the value is empty, malformed
// or uses another protocol. Used by the editors for validation and by the live
// preview so only safe values ever become clickable links.
export function normalizeHttpUrl(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!parsed.hostname) return null
    return parsed.href
  } catch {
    return null
  }
}

export function isValidHttpUrl(value) {
  return normalizeHttpUrl(value) !== null
}
