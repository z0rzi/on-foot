jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({ activitiesRepository: { listOverviewRows: jest.fn() } }))
jest.mock('../../data/trails', () => ({ trailsRepository: { listOverviewRows: jest.fn() } }))

import { useMapStore } from '../../store/mapStore'
import { useTrailsStore } from '../../store/trailsStore'
import { useRecordingStore } from '../../recording/recordingStore'
import type { RecordingSession } from '../../data/activities/types'
import type { TrailOverviewRow } from '../../data/trails/types'
import { showTrail } from '../showTrail'

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}
const trail = (id: number, name: string): TrailOverviewRow => ({
  id, name, difficulty: 'easy',
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  createdAt: id, overviewGeometry: null, start: null,
})

beforeEach(() => {
  useMapStore.setState({ selection: null, pendingFit: null })
  useTrailsStore.setState({ trails: [trail(1, 'Col de la Croix'), trail(2, 'Lac Blanc')] })
  useRecordingStore.setState({ session: null })
})

const selection = () => useMapStore.getState().selection

it('shows the trail while nothing records', () => {
  expect(showTrail(2)).toEqual({ kind: 'shown' })
  expect(selection()).toEqual({ kind: 'trail', id: 2 })
})

describe('while recording', () => {
  beforeEach(() => useRecordingStore.setState({ session }))

  it('makes a recording along no trail along this one', () => {
    expect(showTrail(2)).toEqual({ kind: 'along' })
    expect(selection()).toEqual({ kind: 'trail', id: 2 })
  })

  it('only shows the trail the recording is already along', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 2 } })
    expect(showTrail(2)).toEqual({ kind: 'shown' })
  })

  it('answers that the trail differs from the one recorded along, and shows nothing', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 1 } })
    expect(showTrail(2)).toEqual({ kind: 'differs', recordedAlong: { name: 'Col de la Croix' } })
    expect(selection()).toEqual({ kind: 'trail', id: 1 })
  })

  it('switches the recording to the trail once the caller chose to replace the one recorded along', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 1 } })
    expect(showTrail(2, { replaceAlong: true })).toEqual({ kind: 'along' })
    expect(selection()).toEqual({ kind: 'trail', id: 2 })
  })

  it('treats a recording trail gone from the list as no trail', () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 9 } })
    expect(showTrail(2)).toEqual({ kind: 'along' })
  })
})
