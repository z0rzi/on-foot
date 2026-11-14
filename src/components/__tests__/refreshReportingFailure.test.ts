jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../toast', () => ({ showToast: jest.fn() }))

import { logEvent } from '../../log'
import { showToast } from '../toast'
import { refreshReportingFailure } from '../refreshReportingFailure'

const logged = jest.mocked(logEvent)
const toasted = jest.mocked(showToast)

const failure = { logMessage: 'refreshing the activities list failed', toast: 'Could not refresh the activities' }

beforeEach(() => {
  logged.mockClear()
  toasted.mockClear()
})

describe('refreshReportingFailure', () => {
  test('a refresh that succeeds logs and toasts nothing', async () => {
    await refreshReportingFailure(() => Promise.resolve(), failure)
    expect(logged).not.toHaveBeenCalled()
    expect(toasted).not.toHaveBeenCalled()
  })

  test('a rejected refresh is logged under error and toasted, without rethrowing', async () => {
    await expect(
      refreshReportingFailure(() => Promise.reject(new Error('disk I/O')), failure),
    ).resolves.toBeUndefined()
    expect(logged).toHaveBeenCalledWith('error', 'error', 'refreshing the activities list failed', {
      errorClass: 'Error',
    })
    expect(toasted).toHaveBeenCalledWith('Could not refresh the activities')
  })
})
