const mockRequestAccess = jest.fn()
const mockShowToast = jest.fn()

jest.mock('../../location', () => ({ requestTrackingNotificationAccess: () => mockRequestAccess() }))
jest.mock('../../components/toast', () => ({ showToast: (message: string) => mockShowToast(message) }))

import { ensureTrackingNotificationAccess } from '../notificationAccess'

const HINT = "Notifications are off, so Android won't show that On Foot is recording."

beforeEach(() => {
  jest.clearAllMocks()
})

// The two cases share the module's once-per-process hint flag, so the grant case runs first.
describe('ensureTrackingNotificationAccess', () => {
  it('says nothing when access is granted or does not apply', async () => {
    mockRequestAccess.mockResolvedValueOnce('granted')
    await ensureTrackingNotificationAccess()
    mockRequestAccess.mockResolvedValueOnce('not-applicable')
    await ensureTrackingNotificationAccess()
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('says once per process that notifications are off', async () => {
    mockRequestAccess.mockResolvedValue('denied')
    await ensureTrackingNotificationAccess()
    await ensureTrackingNotificationAccess()
    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(HINT)
  })
})
