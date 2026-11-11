import { useEffect } from 'react'
import { useMapProvider } from './provider'
import { MapTokens } from '../theme/tokens'
import { logEvent } from '../log'

// T-89: a puck that remounts mid-walk is one way its heading arrow can stop turning, so the log
// says when it mounts and unmounts.
export function UserPuckLayer() {
  const { UserPuck } = useMapProvider().components

  useEffect(() => {
    logEvent('info', 'map', 'puck mounted')
    return () => logEvent('info', 'map', 'puck unmounted')
  }, [])

  return <UserPuck scale={MapTokens.puckBearingScale} />
}
