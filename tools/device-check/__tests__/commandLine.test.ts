import { parseCommand, startsTheRecorder } from '../commandLine'

describe('startsTheRecorder', () => {
  it.each([['build-has', 'OnFootLog'], ['labels'], ['log'], ['walk', 'to', 'end', '--pace', 'walk']])(
    'starts it for %s, which reaches the phone',
    (...argv) => {
      expect(startsTheRecorder(parseCommand(argv))).toBe(true)
    },
  )

  it.each([['route', 'DEVCHECK flat', '200'], ['walk', 'status'], ['walk', 'stop'], ['cleanup']])(
    'leaves it alone for %s, which writes a file, stops the recorder or closes a check after cleanup',
    (...argv) => {
      expect(startsTheRecorder(parseCommand(argv))).toBe(false)
    },
  )
})
