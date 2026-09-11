import { useCallback } from 'react'
import { useRouter } from 'expo-router'

// A route can be entered with no history behind it (a system "Open with" cold start via
// app/+native-intent.ts, which routes straight to /trail/new), so a bare back() would strand
// the user.
export function useGoBackOrHome(): () => void {
  const router = useRouter()
  return useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router])
}
