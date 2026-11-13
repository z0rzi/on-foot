jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { listOverviewRows: jest.fn(), getActivity: jest.fn() },
}))

import { useRecordingStore } from '../recordingStore'
import { whenNoRecordingSession } from '../whenNoRecordingSession'
import { activitiesRepository, RecordingSession } from '../../data/activities'

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}

beforeEach(() => {
  jest.mocked(activitiesRepository).listOverviewRows.mockResolvedValue([])
  useRecordingStore.setState({ session: null, resumeSettled: false })
})

test('runs at once when launch has settled with no session', () => {
  useRecordingStore.setState({ resumeSettled: true })
  const run = jest.fn()
  whenNoRecordingSession(run)
  expect(run).toHaveBeenCalledTimes(1)
})

test('waits for launch to settle: before that, no session only means none is known yet', () => {
  const run = jest.fn()
  whenNoRecordingSession(run)
  expect(run).not.toHaveBeenCalled()
  useRecordingStore.setState({ resumeSettled: true })
  expect(run).toHaveBeenCalledTimes(1)
})

test('waits for a resumed session to end, then runs once', () => {
  const run = jest.fn()
  whenNoRecordingSession(run)
  useRecordingStore.setState({ resumeSettled: true, session })
  expect(run).not.toHaveBeenCalled()
  useRecordingStore.getState().reset()
  useRecordingStore.getState().beginSession({ ...session, id: 8 })
  useRecordingStore.getState().reset()
  expect(run).toHaveBeenCalledTimes(1)
})

test('cancelled before the session ends, it never runs', () => {
  const run = jest.fn()
  const cancel = whenNoRecordingSession(run)
  cancel()
  useRecordingStore.setState({ resumeSettled: true })
  expect(run).not.toHaveBeenCalled()
})
