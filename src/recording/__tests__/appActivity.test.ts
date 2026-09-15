let mockCurrentState = 'background'
const mockAddEventListener = jest.fn()

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native')
  const descriptors = Object.getOwnPropertyDescriptors(actual)
  descriptors.AppState = {
    enumerable: true,
    configurable: true,
    value: {
      get currentState() {
        return mockCurrentState
      },
      addEventListener: (type: string, handler: (state: string) => void) => mockAddEventListener(type, handler),
    },
  }
  return Object.create(Object.getPrototypeOf(actual), descriptors)
})

import { isAppActive, whenAppActive } from '../appActivity'

beforeEach(() => {
  jest.clearAllMocks()
  mockCurrentState = 'background'
})

describe('appActivity', () => {
  it('reports whether the app is active', () => {
    expect(isAppActive()).toBe(false)
    mockCurrentState = 'active'
    expect(isAppActive()).toBe(true)
  })

  it('resolves at once when the app is already active', async () => {
    mockCurrentState = 'active'
    await expect(whenAppActive()).resolves.toBeUndefined()
    expect(mockAddEventListener).not.toHaveBeenCalled()
  })

  it('resolves on the first change to active and stops listening', async () => {
    const remove = jest.fn()
    let handler: (state: string) => void = () => {}
    mockAddEventListener.mockImplementation((_type: string, listener: (state: string) => void) => {
      handler = listener
      return { remove }
    })
    let resolved = false
    const waiting = whenAppActive().then(() => {
      resolved = true
    })

    handler('inactive')
    await Promise.resolve()
    expect(resolved).toBe(false)

    handler('active')
    await waiting
    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(remove).toHaveBeenCalled()
  })
})
