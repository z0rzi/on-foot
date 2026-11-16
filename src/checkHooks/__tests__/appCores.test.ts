jest.mock('../../log', () => ({
  ...jest.requireActual('../../log/errorClass'),
  ...jest.requireActual('../../log/launchDetail'),
  logEvent: jest.fn(),
}))
jest.mock('../../data/trails', () => ({ trailsRepository: {} }))
jest.mock('../../data/activities', () => ({ activitiesRepository: {} }))
jest.mock('../../../modules/check-hooks', () => ({ hookFolder: jest.fn() }))
jest.mock('../../trails/deleteTrail', () => ({ deleteTrail: jest.fn(async () => ({ wasRecordedAlong: false })) }))
jest.mock('../../activities/deleteActivity', () => ({ deleteActivity: jest.fn(async () => {}) }))
jest.mock('../../trails/importTrail', () => ({ importTrail: jest.fn(async () => ({ ok: true, id: 31 })) }))
// The snapshot's files are native: the hook folder, the database engine, the app's storage.
jest.mock('../snapshot', () => ({ takeSnapshot: jest.fn() }))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0', extra: { build: { commit: 'c7f942b', uncommitted: '', fingerprint: '5f0c1a2b' } } } },
}))

import { hookFolder } from '../../../modules/check-hooks'
import { deleteActivity } from '../../activities/deleteActivity'
import type { OfflineController } from '../../map/provider/types'
import { deleteTrail } from '../../trails/deleteTrail'
import { importTrail } from '../../trails/importTrail'
import { useOfflineStore } from '../../map/offline/offlineStore'
import { useRecordingStore } from '../../recording/recordingStore'
import { useActivitiesStore } from '../../store/activitiesStore'
import { useMapStore } from '../../store/mapStore'
import { useTrailsStore } from '../../store/trailsStore'
import { appCores, loadingNow } from '../appCores'

const controller: OfflineController = {
  downloadPack: async () => {},
  resumePack: async () => {},
  deletePack: async () => {},
  listPacks: async () => [],
  subscribe: () => () => {},
}
const cores = appCores(controller)

const session = { id: 4, startedAt: 1, linkedTrailId: null, pausedAt: 9, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1 }

beforeEach(() => {
  useMapStore.setState({ selection: null, followMode: 'off', launchResolved: true })
  useRecordingStore.setState({ session: null, resumeSettled: true })
  useTrailsStore.setState({ loaded: true })
  useActivitiesStore.setState({ loaded: true })
  useOfflineStore.setState({ loaded: true })
})

describe("the app's state, read for the state hook", () => {
  it('reads the selection, the modes, the phase and the build', () => {
    useMapStore.setState({ selection: { kind: 'activity', id: 3 }, followMode: 'positionAndBearing' })
    expect(cores.readState()).toEqual({
      selection: { kind: 'activity', id: 3 },
      mapMode: 'activity',
      followMode: 'positionAndBearing',
      recording: 'idle',
      build: { commit: 'c7f942b', uncommitted: '', fingerprint: '5f0c1a2b' },
    })
  })

  it('reads a paused recording as the map in recording mode', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 2 } })
    useRecordingStore.setState({ session })
    expect(cores.readState()).toMatchObject({ mapMode: 'recording', recording: 'paused', selection: { kind: 'trail', id: 2 } })
  })
})

describe("the write hooks' cores, bound to the app's", () => {
  it("deletes a trail with the map's offline controller, an activity on its own", async () => {
    await cores.deleteItem('trail', 5)
    await cores.deleteItem('activity', 12)
    expect(deleteTrail).toHaveBeenCalledWith(controller, 5)
    expect(deleteActivity).toHaveBeenCalledWith(12)
  })

  it('imports a file of the hook folder by its URI', async () => {
    jest.mocked(hookFolder).mockReturnValue('/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks')
    await expect(cores.importTrail({ file: 'import.gpx', name: 'DEVCHECK climb', difficulty: 'hard' })).resolves.toEqual({ ok: true, id: 31 })
    expect(importTrail).toHaveBeenCalledWith({
      uri: 'file:///storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/import.gpx',
      name: 'DEVCHECK climb',
      difficulty: 'hard',
    })
  })

  it('fails an import while shared storage is unmounted', async () => {
    jest.mocked(hookFolder).mockReturnValue(null)
    await expect(cores.importTrail({ file: 'import.gpx', name: 'DEVCHECK climb', difficulty: 'hard' })).rejects.toThrow(
      'the hook folder is unavailable: shared storage is not mounted',
    )
  })
})

describe('the recording live, read for the recording guards', () => {
  it('is none while idle', () => {
    expect(cores.liveSession()).toBeNull()
  })

  it.each([
    ['paused', 9, true],
    ['recording', null, false],
  ])('reads a %s session by its id', (_, pausedAt, paused) => {
    useRecordingStore.setState({ session: { ...session, pausedAt } })
    expect(cores.liveSession()).toEqual({ id: 4, paused })
  })
})

describe('what the app still loads, read from the stores', () => {
  it('is nothing once every store has loaded', () => {
    expect(loadingNow()).toEqual([])
  })

  it('names the stores still loading', () => {
    useMapStore.setState({ launchResolved: false })
    useOfflineStore.setState({ loaded: false })
    useRecordingStore.setState({ resumeSettled: false })
    expect(loadingNow()).toEqual(['launch', 'offline packs', 'recording'])
  })
})

describe('the items the list hook reads', () => {
  it('are the trails store for trails and the activities store for activities', () => {
    const overview = { metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 }, createdAt: 1, overviewGeometry: null, start: null }
    useTrailsStore.setState({ trails: [{ ...overview, id: 5, name: 'DEVCHECK climb', difficulty: 'easy' }] })
    useActivitiesStore.setState({ activities: [{ ...overview, id: 12, name: 'Sunday walk', effort: 'easy', linkedTrailId: null, startedAt: 1 }] })
    expect(cores.listed('trail')).toMatchObject([{ id: 5, name: 'DEVCHECK climb' }])
    expect(cores.listed('activity')).toMatchObject([{ id: 12, name: 'Sunday walk' }])
  })
})
