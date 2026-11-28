import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Draft persistence — the fix for “switching tabs loses edits”.
 *
 * Previously SettingsTab and GenerateTab kept their form state in local
 * useState, so changing tabs unmounted them and the draft was lost; the
 * Workspace also remounted on view change (key={view.id}).
 *
 * Now: every draft lives in Workspace-level state AND is mirrored to
 * localStorage under `mcs-draft:<scope>:<id>`. Switching tabs, switching
 * profiles, or reloading the page restores the draft. A draft is cleared
 * only after a successful save.
 */
export function useDraft<T>(scope: string, id: string, initial: T) {
  const key = `mcs-draft:${scope}:${id}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw) as T
    } catch {
      // Corrupt draft: fall through to the server value.
    }
    return initial
  })
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full / private mode: in-memory draft still works.
    }
  }, [key, value])

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }, [key])

  return { value, setValue, clear, key }
}
