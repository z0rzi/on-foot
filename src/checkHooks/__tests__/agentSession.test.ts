import AsyncStorage from '@react-native-async-storage/async-storage'

const storage = jest.mocked(AsyncStorage)
let stored: Map<string, string>

beforeEach(() => {
  stored = new Map()
  storage.getItem.mockImplementation(async (key) => stored.get(key) ?? null)
  storage.setItem.mockImplementation(async (key, value) => {
    stored.set(key, value)
  })
  storage.removeItem.mockImplementation(async (key) => {
    stored.delete(key)
  })
})

// A relaunch: the module loaded afresh over what storage holds.
const relaunched = () => {
  let record!: typeof import('../agentSession').agentSessionRecord
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.isolateModules needs a synchronous load, and this jest setup rejects dynamic import()
    record = (require('../agentSession') as typeof import('../agentSession')).agentSessionRecord
  })
  return record
}

describe('the agent session record', () => {
  it('holds none at first', async () => {
    await expect(relaunched().read()).resolves.toBeNull()
  })

  it('keeps the session across a relaunch', async () => {
    await relaunched().keep(42)
    await expect(relaunched().read()).resolves.toBe(42)
  })

  it('forgets it once dropped', async () => {
    await relaunched().keep(42)
    await relaunched().drop()
    await expect(relaunched().read()).resolves.toBeNull()
  })

  it('reads an unreadable value as none, so no session passes for an agent one', async () => {
    const record = relaunched()
    await record.keep(42)
    for (const key of stored.keys()) stored.set(key, 'forty-two')
    await expect(record.read()).resolves.toBeNull()
  })
})
