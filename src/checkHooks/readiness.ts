import type { Loading } from './reply'

interface LaunchSteps {
  launchResolved: boolean
  trails: boolean
  activities: boolean
  offlinePacks: boolean
  resumeSettled: boolean
}

// Until each has settled a hook would act on a half-launched app.
export function stillLoading(steps: LaunchSteps): Loading[] {
  const named: [boolean, Loading][] = [
    [steps.launchResolved, 'launch'],
    [steps.trails, 'trails'],
    [steps.activities, 'activities'],
    [steps.offlinePacks, 'offline packs'],
    [steps.resumeSettled, 'recording'],
  ]
  return named.filter(([settled]) => !settled).map(([, name]) => name)
}
