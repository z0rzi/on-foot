import type { OfflineController } from '../map/provider/types'
import { useOfflineStore } from '../map/offline/offlineStore'
import { useTrailsStore } from '../store/trailsStore'
import { useMapStore } from '../store/mapStore'
import { currentAlongTrailId } from '../recording/currentAlongTrail'
import { errorClass, logEvent } from '../log'

export interface TrailDeleted {
  wasRecordedAlong: boolean
}

// Removes the trail's offline map, then the trail, then drops it from the map if it was shown. The
// recording's trail goes too: the recording carries on along no trail.
export async function deleteTrail(controller: OfflineController, id: number): Promise<TrailDeleted> {
  try {
    await useOfflineStore.getState().removeForTrail(controller, id)
    await useTrailsStore.getState().removeTrail(id)
  } catch (error) {
    logEvent('error', 'error', 'deleting the trail failed', { errorClass: errorClass(error) })
    throw error
  }
  const wasRecordedAlong = currentAlongTrailId() === id
  useMapStore.getState().forgetEntity('trail', id)
  return { wasRecordedAlong }
}
