import { useEffect } from 'react'
import { errorClass, logEvent } from '../log'
import { useActivitiesStore } from './activitiesStore'
import { useTrailsStore } from './trailsStore'

const logFailure = (message: string) => (error: unknown) =>
  logEvent('warn', 'map', message, { errorClass: errorClass(error) })

// A failure leaves its store empty until the next load: a list's focus refresh or a mutation.
export async function loadStoresAtLaunch(): Promise<void> {
  await Promise.all([
    useTrailsStore.getState().loadTrails().catch(logFailure('loading the trails at launch failed')),
    useActivitiesStore.getState().loadActivities().catch(logFailure('loading the activities at launch failed')),
  ])
}

// Mounted once the migrations have run.
export function useStoresAtLaunch(): void {
  useEffect(() => {
    void loadStoresAtLaunch()
  }, [])
}
