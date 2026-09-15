const mockRequestAccess = jest.fn()
const mockShowToast = jest.fn()

jest.mock('../../location', () => ({ requestTrackingNotificationAccess: () => mockRequestAccess() }))
jest.mock('../../components/toast', () => ({ showToast: (message: string) => mockShowToast(message) }))

const HINT = "Notifications are off, so Android won't show that On Foot is recording."

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
})

describe('ensureTrackingNotificationAccess', () => {
  it('says once per process that notifications are off', async () => {
    mockRequestAccess.mockResolvedValue('denied')
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import() is unsupported by this repo's Jest runtime without --experimental-vm-modules; require() after resetModules() is the only way to get a fresh module instance per test.
    const { ensureTrackingNotificationAccess } = require('../notificationAccess')
    await ensureTrackingNotificationAccess()
    await ensureTrackingNotificationAccess()
    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(HINT)
  })

  it('says nothing when access is granted or does not apply', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import() is unsupported by this repo's Jest runtime without --experimental-vm-modules; require() after resetModules() is the only way to get a fresh module instance per test.
    const { ensureTrackingNotificationAccess } = require('../notificationAccess')
    mockRequestAccess.mockResolvedValueOnce('granted')
    await ensureTrackingNotificationAccess()
    mockRequestAccess.mockResolvedValueOnce('not-applicable')
    await ensureTrackingNotificationAccess()
    expect(mockShowToast).not.toHaveBeenCalled()
  })
})
