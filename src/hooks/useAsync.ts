import { useState, useCallback, useRef, useEffect } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

export function useAsync<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: UseAsyncOptions<T>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  // Stable refs so refetch doesn't change identity on every render
  const fetcherRef = useRef(fetcher)
  const optionsRef = useRef(options)
  useEffect(() => {
    fetcherRef.current = fetcher
    optionsRef.current = options
  })

  const run = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const result = await fetcherRef.current()
      setState({ data: result, loading: false, error: null })
      optionsRef.current?.onSuccess?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setState({ data: null, loading: false, error })
      optionsRef.current?.onError?.(error)
    }
  }, [])

  const enabled = options?.enabled !== false

  useEffect(() => {
    if (enabled) run()
  }, [key, enabled, run])

  return { ...state, refetch: run }
}
