import { parseCommand, startsTheRecorder } from '../commandLine'

describe('startsTheRecorder', () => {
  it.each([['build-has', 'OnFootLog'], ['labels'], ['log'], ['walk', 'to', 'end', '--pace', 'walk']])(
    'starts it for %s, which reaches the phone',
    (...argv) => {
      expect(startsTheRecorder(parseCommand(argv))).toBe(true)
    },
  )

  it.each([['route', 'DEVCHECK flat', '200'], ['walk', 'status'], ['walk', 'stop'], ['cleanup'], ['build']])(
    'leaves it alone for %s, which writes a file, stops the recorder, closes a check after cleanup or builds',
    (...argv) => {
      expect(startsTheRecorder(parseCommand(argv))).toBe(false)
    },
  )
})

describe('parseCommand', () => {
  it('reads a command of two words by its action', () => {
    expect(parseCommand(['walk', 'stop', '--force'])).toEqual({ command: 'walk-stop', force: true })
    expect(parseCommand(['walk', 'jump', 'end', '--offset', '5'])).toEqual({
      command: 'walk-jump',
      mark: 'end',
      options: { route: undefined, offset: 5, accuracy: undefined },
    })
  })

  it.each([
    [['walk', 'sideways'], 'unknown walk action "sideways"'],
    [['walk'], 'unknown walk action ""'],
    [['wlak', 'to', 'end'], 'unknown command "wlak"'],
    [[], 'no command'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseCommand(argv)).toThrow(message)
  })
})

describe('build-has', () => {
  it('looks for a string in the bundle', () => {
    expect(parseCommand(['build-has', 'OnFootLog'])).toEqual({ command: 'build-has', text: 'OnFootLog', commit: false })
  })

  it('asks for a commit with --commit', () => {
    expect(parseCommand(['build-has', '--commit', 'c7f942b'])).toEqual({ command: 'build-has', text: 'c7f942b', commit: true })
  })
})

describe('import-gpx', () => {
  it("reads the difficulty as the app names it, Easy unless told", () => {
    expect(parseCommand(['import-gpx', 'DEVCHECK-climb.gpx', '--difficulty', 'Medium'])).toEqual({ command: 'import-gpx', file: 'DEVCHECK-climb.gpx', difficulty: 'medium' })
    expect(parseCommand(['import-gpx', 'DEVCHECK-climb.gpx'])).toEqual({ command: 'import-gpx', file: 'DEVCHECK-climb.gpx', difficulty: 'easy' })
  })

  it('refuses a difficulty the app does not have', () => {
    expect(() => parseCommand(['import-gpx', 'x.gpx', '--difficulty', 'Brutal'])).toThrow('--difficulty must be one of Easy, Medium, Hard')
  })
})

describe('delete', () => {
  it('reads the kind and the id', () => {
    expect(parseCommand(['delete', 'activity', '12'])).toEqual({ command: 'delete', kind: 'activity', id: 12 })
  })

  it.each([
    [['delete', 'trail', 'DEVCHECK climb'], 'the id must be a whole number, as `list` gives it'],
    [['delete', 'trail', '1.5'], 'the id must be a whole number, as `list` gives it'],
    [['delete', 'route', '5'], 'expected delete trail|activity <id>'],
    [['delete', 'trail'], 'expected delete trail|activity <id>'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseCommand(argv)).toThrow(message)
  })
})

describe('record', () => {
  it.each(['start', 'pause', 'resume', 'discard'])('reads record %s, which takes no arguments', (action) => {
    expect(parseCommand(['record', action])).toEqual({ command: `record-${action}` })
    expect(() => parseCommand(['record', action, 'x'])).toThrow(`expected record ${action} with no arguments`)
  })

  it('saves under the DEVCHECK name, with the effort the app reads', () => {
    expect(parseCommand(['record', 'save', 'climb', '--effort', 'Hard'])).toEqual({
      command: 'record-save',
      name: 'DEVCHECK climb',
      effort: 'hard',
    })
    expect(parseCommand(['record', 'save', 'DEVCHECK climb'])).toEqual({ command: 'record-save', name: 'DEVCHECK climb', effort: 'easy' })
  })

  it.each([
    [['record', 'save'], 'expected record save <name>'],
    [['record', 'save', 'climb', '--effort', 'Brutal'], '--effort must be one of Easy, Moderate, Hard, Max'],
    [['record', 'stop'], 'unknown record action "stop"'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseCommand(argv)).toThrow(message)
  })

  it('starts the recorder: it reaches the phone', () => {
    expect(startsTheRecorder(parseCommand(['record', 'start']))).toBe(true)
  })
})

describe('the read and select hooks', () => {
  it('reads list, select and clear-selection into what the hooks are sent', () => {
    expect(parseCommand(['list', 'trails'])).toEqual({ command: 'list', kind: 'trail' })
    expect(parseCommand(['list', 'activities'])).toEqual({ command: 'list', kind: 'activity' })
    expect(parseCommand(['select', 'trail', '5'])).toEqual({ command: 'select', kind: 'trail', id: 5 })
    expect(parseCommand(['select', 'activity', '12'])).toEqual({ command: 'select', kind: 'activity', id: 12 })
    expect(parseCommand(['clear-selection'])).toEqual({ command: 'clear-selection' })
  })

  it.each([
    [['list'], 'expected list trails|activities'],
    [['list', 'trail'], 'expected list trails|activities'],
    [['select', 'trail'], 'expected select trail|activity <id>'],
    [['select', 'trails', '5'], 'expected select trail|activity <id>'],
    [['select', 'trail', 'DEVCHECK climb'], 'the id must be a whole number, as `list` gives it'],
    [['select', 'trail', '1.5'], 'the id must be a whole number, as `list` gives it'],
    [['clear-selection', 'trail'], 'expected clear-selection with no arguments'],
  ])('refuses %j', (argv, message) => {
    expect(() => parseCommand(argv)).toThrow(message)
  })
})
