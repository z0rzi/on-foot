import { useEffect, useRef } from 'react'
import { usePathname } from 'expo-router'
import { addCheckHookListener } from '../../modules/check-hooks'
import { useOfflineController } from '../map/provider'
import { appCores, loadingNow } from './appCores'
import { createDispatcher, deliverReply } from './dispatcher'
import { HOOKS } from './hooks'

// Mounted outside the launch gate, so it answers `not-ready` from the app's first render.
export function CheckHookDispatcher() {
  const pathname = usePathname()
  const controller = useOfflineController()
  const screen = useRef(pathname)

  useEffect(() => {
    screen.current = pathname
  }, [pathname])

  useEffect(() => {
    const dispatch = createDispatcher({
      hooks: HOOKS,
      cores: appCores(controller),
      app: () => ({ screen: screen.current, loading: loadingNow() }),
    })
    // The dispatcher answers every request and never rejects; a reply that throws is logged.
    const sub = addCheckHookListener((request, reply) => void deliverReply(dispatch(request), reply))
    return () => sub.remove()
  }, [controller])

  return null
}
