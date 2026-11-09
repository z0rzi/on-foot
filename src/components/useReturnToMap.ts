import { useCallback } from 'react'
import { useRouter } from 'expo-router'

// The one way back to the Map. dismissTo pops to the Map already in the stack, or replaces the
// current screen with one when there is none underneath (a cold-start "Open with" enters
// /trail/new directly). navigate('/') from a pushed screen would mount a second Map instead.
export function useReturnToMap(): () => void {
  const router = useRouter()
  return useCallback(() => router.dismissTo('/'), [router])
}
