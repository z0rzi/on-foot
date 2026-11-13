import { coalesceBursts, createOverviewFileWriter, type OverviewFileStore } from '../overviewFiles'

const WINDOW_MS = 100

// A directory in memory, the files by name.
function memoryStore(initial: Record<string, string> = {}): OverviewFileStore & { files: Map<string, string> } {
  const files = new Map(Object.entries(initial))
  return {
    files,
    list: () => [...files.keys()],
    write: (name, text) => {
      files.set(name, text)
      return `file:///docs/overview/${name}`
    },
    remove: (name) => {
      files.delete(name)
    },
  }
}

describe('the overview file writer', () => {
  it('gives every version a new name of lowercase letters, digits and dashes, before its extension', () => {
    const store = memoryStore()
    const writer = createOverviewFileWriter('lines', 'mh3k2a', store)
    const first = writer.write('one')
    const second = writer.write('two')
    expect(first).not.toEqual(second)
    for (const name of store.files.keys()) expect(name).toMatch(/^[a-z0-9-]+\.json$/)
  })

  it('returns the uri of the file it wrote, which holds the text', () => {
    const store = memoryStore()
    const uri = createOverviewFileWriter('lines', 's1', store).write('text')
    const [name] = store.files.keys()
    expect(uri).toBe(`file:///docs/overview/${name}`)
    expect(store.files.get(name)).toBe('text')
  })

  it('writes nothing when the text is what the current file holds', () => {
    const store = memoryStore()
    const writer = createOverviewFileWriter('lines', 's1', store)
    writer.write('same')
    expect(writer.write('same')).toBeNull()
    expect(store.files.size).toBe(1)
  })

  it('names a new session apart from the files of an earlier one', () => {
    const store = memoryStore()
    createOverviewFileWriter('lines', 'aaa', store).write('x')
    createOverviewFileWriter('lines', 'bbb', store).write('x')
    expect(store.files.size).toBe(2)
  })

  it('keeps the current file and its predecessor after a switch, and deletes the older ones', () => {
    const store = memoryStore()
    const writer = createOverviewFileWriter('lines', 's1', store)
    writer.write('v1')
    writer.write('v2')
    writer.write('v3')
    writer.pruneAfterSwitch()
    expect([...store.files.values()].sort()).toEqual(['v2', 'v3'])
  })

  it('deletes a file left by a failed write after the next switch', () => {
    const store = memoryStore()
    let fail = false
    const leaky: OverviewFileStore = {
      ...store,
      write: (name, text) => {
        if (!fail) return store.write(name, text)
        store.files.set(name, 'partial')
        throw new Error('disk full')
      },
    }
    const writer = createOverviewFileWriter('lines', 's1', leaky)
    writer.write('v1')
    fail = true
    expect(() => writer.write('v2')).toThrow('disk full')
    fail = false
    writer.write('v3')
    writer.write('v4')
    writer.pruneAfterSwitch()
    expect([...store.files.values()].sort()).toEqual(['v3', 'v4'])
  })

  it('keeps the current file when a write fails, and writes the same text again on the next try', () => {
    const store = memoryStore()
    let fail = false
    const flaky: OverviewFileStore = {
      ...store,
      write: (name, text) => {
        if (fail) throw new Error('disk full')
        return store.write(name, text)
      },
    }
    const writer = createOverviewFileWriter('lines', 's1', flaky)
    writer.write('v1')
    fail = true
    expect(() => writer.write('v2')).toThrow('disk full')
    fail = false
    expect(writer.write('v2')).not.toBeNull()
    writer.pruneAfterSwitch()
    expect([...store.files.values()].sort()).toEqual(['v1', 'v2'])
  })

  it('deletes every file of its source at mount, from any session, and nothing else', () => {
    const store = memoryStore({
      'overview-lines-old-1.json': 'a',
      'overview-lines-old-2.json': 'b',
      'overview-pins-old-1.json': 'c',
      'notes.txt': 'd',
    })
    createOverviewFileWriter('lines', 's1', store).clearAtMount()
    expect([...store.files.keys()].sort()).toEqual(['notes.txt', 'overview-pins-old-1.json'])
  })

  it('never deletes another source’s files after a switch', () => {
    const store = memoryStore({ 'overview-pins-s1-1.json': 'pins' })
    const writer = createOverviewFileWriter('lines', 's1', store)
    writer.write('v1')
    writer.write('v2')
    writer.write('v3')
    writer.pruneAfterSwitch()
    expect(store.files.has('overview-pins-s1-1.json')).toBe(true)
  })
})

describe('coalescing a burst of changes', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('writes once per burst, with the latest change', () => {
    const flush = jest.fn()
    const burst = coalesceBursts<string>(WINDOW_MS, flush)
    burst.request('activities reloaded')
    burst.request('trails reloaded')
    jest.advanceTimersByTime(WINDOW_MS)
    expect(flush.mock.calls).toEqual([['trails reloaded']])
  })

  it('writes within one window of the first change, however long changes keep coming', () => {
    const flush = jest.fn()
    const burst = coalesceBursts<number>(WINDOW_MS, flush)
    for (let i = 0; i < 5; i++) {
      burst.request(i)
      jest.advanceTimersByTime(WINDOW_MS / 4)
    }
    expect(flush.mock.calls[0]).toEqual([3])
  })

  it('starts a new burst after a write', () => {
    const flush = jest.fn()
    const burst = coalesceBursts<string>(WINDOW_MS, flush)
    burst.request('a')
    jest.advanceTimersByTime(WINDOW_MS)
    burst.request('b')
    jest.advanceTimersByTime(WINDOW_MS)
    expect(flush.mock.calls).toEqual([['a'], ['b']])
  })

  it('writes nothing once cancelled', () => {
    const flush = jest.fn()
    const burst = coalesceBursts<string>(WINDOW_MS, flush)
    burst.request('a')
    burst.cancel()
    jest.advanceTimersByTime(WINDOW_MS)
    expect(flush).not.toHaveBeenCalled()
  })
})
