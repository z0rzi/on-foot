import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useReturnToMap } from './useReturnToMap'

// One level back, or to the Map when there is no history behind the screen (a cold-start
// "Open with", app/+native-intent.ts), where a bare back() would strand the user.
export function useGoBackOrHome(): () => void {
  const router = useRouter()
  const returnToMap = useReturnToMap()
  return useCallback(
    () => (router.canGoBack() ? router.back() : returnToMap()),
    [router, returnToMap],
  )
}
