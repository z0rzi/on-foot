import { useCallback } from 'react'
import { Href, useRouter } from 'expo-router'

// A route can be entered with no history behind it (a system "Open with" cold start via
// app/+native-intent.ts, which routes straight to /trail/new), so a bare back() would strand
// the user. `fallback` is where that case lands instead of the default home route.
export function useGoBackOrHome(fallback: Href = '/'): () => void {
  const router = useRouter()
  return useCallback(
    () => (router.canGoBack() ? router.back() : router.replace(fallback)),
    [router, fallback],
  )
}
