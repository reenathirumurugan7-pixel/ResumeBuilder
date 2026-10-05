import { useState, useEffect, useLayoutEffect } from 'react'
import { ThemeContext } from './themeContextStore'

const STORAGE_KEY = 'resumeBuilderTheme'

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch { /* ignore */ }
  return 'system'
}

function resolveActual(theme) {
  if (theme !== 'system') return theme
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(theme) {
  const actual = resolveActual(theme)
  document.documentElement.setAttribute('data-theme', actual)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  // Layout effect, not a passive one: the browser has already painted by the
  // time a useEffect callback runs, so a dark-mode user saw a white flash on
  // every load. useLayoutEffect runs after the DOM update but before paint.
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(theme)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // `theme` is the preference ('system' is not a palette); components that need
  // to branch on light vs dark have to read the resolved value.
  const resolvedTheme = resolveActual(theme)

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  )
}
