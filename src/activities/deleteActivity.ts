import { useActivitiesStore } from '../store/activitiesStore'
import { useMapStore } from '../store/mapStore'
import { errorClass, logEvent } from '../log'

// Removes the activity, then drops it from the map if it was shown.
export async function deleteActivity(id: number): Promise<void> {
  try {
    await useActivitiesStore.getState().removeActivity(id)
  } catch (error) {
    logEvent('error', 'error', 'deleting the activity failed', { errorClass: errorClass(error) })
    throw error
  }
  useMapStore.getState().forgetEntity('activity', id)
}
