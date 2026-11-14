import type { Activity } from '../data/activities/types'
import type { Trail } from '../data/trails/types'
import { errorClass, logEvent } from '../log'

export interface ActivityWithLinkedTrail extends Activity {
  linkedTrail: Trail | null
}

// The trail is read in the same load as the activity, so the link it follows is never one a later
// mutation already cleared. A link that cannot be followed is logged and rendered as no link; it
// does not make the activity itself unavailable.
export async function loadActivityWithLinkedTrail(
  id: number,
  getActivity: (id: number) => Promise<Activity | null>,
  getTrail: (id: number) => Promise<Trail | null>,
): Promise<ActivityWithLinkedTrail | null> {
  const activity = await getActivity(id)
  if (activity == null) return null
  const trailId = activity.linkedTrailId
  if (trailId == null) return { ...activity, linkedTrail: null }
  try {
    const linkedTrail = await getTrail(trailId)
    if (linkedTrail == null) logEvent('warn', 'error', 'linked trail not found', { id: trailId })
    return { ...activity, linkedTrail }
  } catch (err) {
    logEvent('error', 'error', 'linked trail load failed', { id: trailId, errorClass: errorClass(err) })
    return { ...activity, linkedTrail: null }
  }
}
