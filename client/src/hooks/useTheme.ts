import { useCallback, useSyncExternalStore } from 'react'

export type BrandTheme = 'daylight' | 'nocturne' | 'blackrock'

const THEME_STORAGE_KEY = 'mcs-ui-theme'
const listeners = new Set<() => void>()

export function normalizeTheme(raw: string | null | undefined): BrandTheme {
  if (raw === 'daylight' || raw === 'light') return 'daylight'
  if (raw === 'nocturne' || raw === 'dark') return 'nocturne'
  return 'blackrock'
}

function getSnapshot(): BrandTheme {
  if (typeof document === 'undefined') return 'blackrock'
  return normalizeTheme(document.documentElement.dataset.theme)
}

function getServerSnapshot(): BrandTheme {
  return 'blackrock'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function applyTheme(theme: BrandTheme): void {
  if (typeof document === 'undefined') return
  const isDark = theme !== 'daylight'
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', isDark)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* ignore private mode */
  }
  for (const listener of listeners) listener()
}

export function initSavedTheme(): void {
  try {
    applyTheme(normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY)))
  } catch {
    applyTheme('blackrock')
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const dark = theme !== 'daylight'

  const setTheme = useCallback((next: BrandTheme) => {
    applyTheme(next)
  }, [])

  const cycleTheme = useCallback(() => {
    const order: BrandTheme[] = ['blackrock', 'daylight', 'nocturne']
    const idx = order.indexOf(getSnapshot())
    applyTheme(order[(idx + 1) % order.length])
  }, [])

  return { theme, dark, setTheme, cycleTheme }
}
