import { Dispatch, SetStateAction, useEffect, useState } from 'react'

interface UsePersistentStateOptions<T> {
  validate?: (value: unknown) => value is T
}

export function usePersistentState<T>(
  storageKey: string,
  initialValue: T,
  options: UsePersistentStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        return initialValue
      }

      const parsed = JSON.parse(raw) as unknown
      if (options.validate && !options.validate(parsed)) {
        return initialValue
      }

      return parsed as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Ignore storage errors. UI should still work with in-memory state.
    }
  }, [state, storageKey])

  return [state, setState]
}
