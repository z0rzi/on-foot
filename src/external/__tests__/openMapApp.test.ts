jest.mock('expo-linking', () => ({ openURL: jest.fn() }))
jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../components/toast', () => ({ showToast: jest.fn() }))

import { openURL } from 'expo-linking'
import { logEvent } from '../../log'
import { showToast } from '../../components/toast'
import { openMapApp } from '../openMapApp'
import { geoUri } from '../geoUri'

const opened = jest.mocked(openURL)
const logged = jest.mocked(logEvent)
const toasted = jest.mocked(showToast)

const point = { lat: 45.5, lng: 6.25 }

beforeEach(() => {
  opened.mockReset()
  logged.mockClear()
  toasted.mockClear()
})

describe('openMapApp', () => {
  test('hands the geo: URI to the linking SDK and logs the hand-off', async () => {
    opened.mockResolvedValue(true)
    await openMapApp(point, 'Col de Bise')
    expect(opened).toHaveBeenCalledWith(geoUri(point, 'Col de Bise'))
    expect(logged).toHaveBeenCalledWith('info', 'map', 'opened external map app')
    expect(toasted).not.toHaveBeenCalled()
  })

  // On Android a rejection means no activity handled the intent: startActivity has already
  // resolved by the time the chooser is drawn, so the message can name the actual cause.
  test('reports exactly once when no app handles the intent', async () => {
    opened.mockRejectedValue(new Error('No Activity found to handle Intent'))
    await openMapApp(point, 'Col de Bise')
    expect(toasted).toHaveBeenCalledTimes(1)
    expect(toasted).toHaveBeenCalledWith('No map app found')
    expect(logged).toHaveBeenCalledWith('warn', 'map', 'map app launch failed', {
      error: 'Error: No Activity found to handle Intent',
    })
  })

  test('resolves rather than rejecting, so a fire-and-forget caller cannot raise', async () => {
    opened.mockRejectedValue(new Error('nope'))
    await expect(openMapApp(point, 'Col de Bise')).resolves.toBeUndefined()
  })

  test('keeps coordinates out of the debug log', async () => {
    opened.mockResolvedValue(true)
    await openMapApp(point, 'Col de Bise')
    opened.mockRejectedValue(new Error('nope'))
    await openMapApp(point, 'Col de Bise')
    const written = JSON.stringify(logged.mock.calls)
    expect(written).not.toContain('45.5')
    expect(written).not.toContain('6.25')
  })
})
