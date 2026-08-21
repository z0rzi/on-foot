import { useEffect, useRef } from 'react'
import { useRootNavigationState, useRouter } from 'expo-router'
import { addShareIntentListener, getInitialShareIntentUri } from '../../modules/share-intent'

export function useIncomingShare() {
  const router = useRouter()
  const navReady = !!useRootNavigationState()?.key
  const handledInitial = useRef(false)

  useEffect(() => {
    const sub = addShareIntentListener((uri) => {
      router.push(`/trail/new?uri=${encodeURIComponent(uri)}`)
    })
    return () => sub.remove()
  }, [router])

  useEffect(() => {
    if (!navReady || handledInitial.current) return
    handledInitial.current = true
    const uri = getInitialShareIntentUri()
    if (uri) router.push(`/trail/new?uri=${encodeURIComponent(uri)}`)
  }, [navReady, router])
}
