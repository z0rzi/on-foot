jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({ activitiesRepository: { listOverviewRows: jest.fn() } }))

import { useMapStore } from '../../store/mapStore'
import { useRecordingStore } from '../../recording/recordingStore'
import type { RecordingSession } from '../../data/activities/types'
import { showActivity } from '../showActivity'

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}

beforeEach(() => {
  useMapStore.setState({ selection: { kind: 'trail', id: 3 }, pendingFit: null })
  useRecordingStore.setState({ session: null })
})

it('shows the activity on the map while nothing records', () => {
  expect(showActivity(12)).toEqual({ kind: 'shown' })
  expect(useMapStore.getState().selection).toEqual({ kind: 'activity', id: 12 })
})

it('refuses while recording, leaving the recording on its trail', () => {
  useRecordingStore.setState({ session })
  expect(showActivity(12)).toEqual({ kind: 'refused-recording' })
  expect(useMapStore.getState().selection).toEqual({ kind: 'trail', id: 3 })
})

it('refuses while the recording is paused', () => {
  useRecordingStore.setState({ session: { ...session, pausedAt: 2000 } })
  expect(showActivity(12)).toEqual({ kind: 'refused-recording' })
})
