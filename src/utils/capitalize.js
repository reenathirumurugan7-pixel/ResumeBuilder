// Uppercases the first letter of every word while leaving every other
// character untouched, so mixed-case names, acronyms and existing capitals
// (for example "McDonald" or "B.Tech") are preserved.
const WORD_START = /(^|[\s.-])(\p{Ll})/gu

export function capitalizeWords(value) {
  if (typeof value !== 'string' || value.length === 0) return value
  return value.replace(WORD_START, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
}

// Capitalizes a controlled input's value from its change event and restores
// the caret afterwards. Capitalization only changes letter case, so the
// existing selection offsets remain valid.
export function capitalizeInputValue(event) {
  const input = event.target
  const rawValue = input.value
  const nextValue = capitalizeWords(rawValue)
  if (nextValue === rawValue) return rawValue

  const selectionStart = input.selectionStart
  const selectionEnd = input.selectionEnd

  window.requestAnimationFrame(() => {
    if (!input.isConnected || selectionStart == null) return
    try {
      input.setSelectionRange(selectionStart, selectionEnd)
    } catch {
      // Some input types do not support text selection.
    }
  })

  return nextValue
}
