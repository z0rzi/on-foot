import { captureRefusalAlert } from '../captureAlerts'

describe('captureRefusalAlert', () => {
  it('asks for "All the time" access whichever action was refused', () => {
    const expected = {
      title: 'Location permission needed',
      message: 'To record your activity while the app is in the background, allow location access "All the time".',
    }
    expect(captureRefusalAlert('permission-denied', 'start')).toEqual(expected)
    expect(captureRefusalAlert('permission-denied', 'resume')).toEqual(expected)
  })

  it('names the refused action when location is off', () => {
    expect(captureRefusalAlert('location-off', 'start')).toEqual({
      title: 'Location is off',
      message: 'Turn on location to start recording.',
    })
    expect(captureRefusalAlert('location-off', 'resume')).toEqual({
      title: 'Location is off',
      message: 'Turn on location to resume recording.',
    })
  })
})
