jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import type { RecordingPhase } from '../../recording/recordingPhase'
import { createDispatcher } from '../dispatcher'
import { HOOKS, type Cores } from '../hooks'

const read: ReturnType<Cores['readState']> = {
  selection: { kind: 'trail', id: 7 },
  mapMode: 'trail',
  followMode: 'off',
  recording: 'idle',
  build: { commit: 'c7f942b1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7', uncommitted: '', fingerprint: '5f0c1a2b' },
}
const files = {
  database: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot.db',
  preferences: '/storage/emulated/0/Android/data/com.zorzi.onfootrn/files/hooks/snapshot-preferences.json',
}

const TRAILS = [
  { id: 3, name: 'Tour du Canigou' },
  { id: 5, name: 'DEVCHECK climb' },
  { id: 8, name: 'DEVCHECKER' },
  { id: 9, name: 'DEVCHECK flat' },
]
const ACTIVITIES = [{ id: 12, name: 'Sunday walk' }]

// The app as the recording hooks see it: one recording at most, and the agent session a hook kept.
let live: { id: number; paused: boolean } | null
let kept: number | null
let calls: string[]

function fakeCores(recording: RecordingPhase = 'idle') {
  return {
    readState: () => read,
    recordingPhase: () => recording,
    listed: (kind: 'trail' | 'activity') => (kind === 'trail' ? TRAILS : ACTIVITIES),
    showTrail: jest.fn<ReturnType<Cores['showTrail']>, [number]>(() => ({ kind: 'shown' })),
    showActivity: jest.fn<ReturnType<Cores['showActivity']>, [number]>(() => ({ kind: 'shown' })),
    clearSelection: jest.fn(),
    takeSnapshot: () => Promise.resolve(files),
    deleteItem: () => Promise.reject(new Error('no delete expected')),
    importTrail: () => Promise.reject(new Error('no import expected')),
    liveSession: () => live,
    agentSession: {
      read: async () => kept,
      keep: async (id: number) => {
        kept = id
      },
      drop: async () => {
        kept = null
      },
    },
    startRecording: jest.fn<ReturnType<Cores['startRecording']>, []>(async () => {
      calls.push('start')
      live = { id: 42, paused: false }
      return 'started'
    }),
    pauseRecording: jest.fn(async () => {
      calls.push('pause')
      live = live && { ...live, paused: true }
    }),
    resumeRecording: jest.fn<ReturnType<Cores['resumeRecording']>, []>(async () => {
      calls.push('resume')
      live = live && { ...live, paused: false }
      return 'resumed'
    }),
    discardRecording: jest.fn(async (id: number) => {
      calls.push(`discard ${id}`)
      live = null
    }),
    stopForSave: jest.fn(async () => {
      calls.push('stop for save')
    }),
    loadRecording: jest.fn<ReturnType<Cores['loadRecording']>, []>(async () => {
      calls.push('load')
      return live && {
        session: { id: live.id, startedAt: 0, linkedTrailId: null, pausedAt: 1, pausedMs: 0, currentSegment: 0, segmentStartedAt: 0 },
        segments: [],
      }
    }),
    saveRecording: jest.fn(async ({ session }: { session: { id: number } }) => {
      calls.push(`save ${session.id}`)
      live = null
      return 31
    }),
  } satisfies Cores
}

const dispatchTo =
  (cores: Cores) =>
  (hook: string, args: unknown = {}, screen: string | null = '/') =>
    createDispatcher({ hooks: HOOKS, cores, app: () => ({ screen, loading: [] }) })({ hook, args: JSON.stringify(args) })

let cores: ReturnType<typeof fakeCores>

beforeEach(() => {
  live = null
  kept = null
  calls = []
  cores = fakeCores()
})

const dispatch = (hook: string, args: unknown = {}, screen: string | null = '/') => dispatchTo(cores)(hook, args, screen)

const anAgentSession = (paused = false) => {
  live = { id: 42, paused }
  kept = 42
}
const theOwnersSession = (paused = false) => {
  live = { id: 40, paused }
  kept = null
}

describe('state', () => {
  it('answers with the screen in front and what the readers say', async () => {
    await expect(dispatch('state', {}, '/settings/log')).resolves.toEqual({
      reply: 'ok',
      data: { screen: '/settings/log', ...read, agentSession: false },
    })
  })

  it('says whether the recording live is an agent session', async () => {
    anAgentSession()
    await expect(dispatch('state')).resolves.toMatchObject({ data: { agentSession: true } })
    theOwnersSession()
    await expect(dispatch('state')).resolves.toMatchObject({ data: { agentSession: false } })
  })

  it('is a read: it answers whatever screen is in front', async () => {
    await expect(dispatch('state', {}, '/activity/save')).resolves.toMatchObject({ reply: 'ok' })
  })

  it('takes no arguments', async () => {
    await expect(dispatch('state', { id: 1 })).resolves.toEqual({ reply: 'refused', reason: 'this hook takes no arguments' })
  })
})

describe('list', () => {
  it('gives the DEVCHECK items by id and name, and only a count of the others', async () => {
    await expect(dispatch('list', { kind: 'trail' })).resolves.toEqual({
      reply: 'ok',
      data: {
        devcheck: [
          { id: 5, name: 'DEVCHECK climb' },
          { id: 9, name: 'DEVCHECK flat' },
        ],
        others: 2,
      },
    })
    await expect(dispatch('list', { kind: 'activity' })).resolves.toEqual({ reply: 'ok', data: { devcheck: [], others: 1 } })
  })

  it('is a read: it answers while recording, whatever screen is in front', async () => {
    await expect(dispatchTo(fakeCores('recording'))('list', { kind: 'trail' }, '/activities')).resolves.toMatchObject({ reply: 'ok' })
  })

  it.each([{}, { kind: 'trails' }, { kind: 'trail', id: 5 }])('refuses %j, naming the argument', async (args) => {
    await expect(dispatch('list', args)).resolves.toEqual({ reply: 'refused', reason: 'expected { kind: "trail" | "activity" }' })
  })
})

const WHILE_RECORDING = 'refused while recording: a hook never changes what the map shows of a recording'

describe('select', () => {
  it('shows a trail through the show-trail core', async () => {
    const cores = fakeCores()
    await expect(dispatchTo(cores)('select', { kind: 'trail', id: 5 })).resolves.toEqual({ reply: 'ok', data: null })
    expect(cores.showTrail).toHaveBeenCalledWith(5)
  })

  it('shows an activity through the show-activity core', async () => {
    const cores = fakeCores()
    await expect(dispatchTo(cores)('select', { kind: 'activity', id: 12 })).resolves.toEqual({ reply: 'ok', data: null })
    expect(cores.showActivity).toHaveBeenCalledWith(12)
  })

  it.each<[RecordingPhase, 'trail' | 'activity', number]>([
    ['recording', 'trail', 5],
    ['paused', 'trail', 5],
    ['recording', 'activity', 12],
  ])('is refused while %s, a %s %d too, and calls no core', async (phase, kind, id) => {
    const cores = fakeCores(phase)
    await expect(dispatchTo(cores)('select', { kind, id })).resolves.toEqual({ reply: 'refused', reason: WHILE_RECORDING })
    expect(cores.showTrail).not.toHaveBeenCalled()
    expect(cores.showActivity).not.toHaveBeenCalled()
  })

  it("passes the core's own refusal through", async () => {
    const cores = fakeCores()
    cores.showActivity.mockReturnValue({ kind: 'refused-recording' })
    cores.showTrail.mockReturnValue({ kind: 'differs', recordedAlong: { name: 'Tour du Canigou' } })
    await expect(dispatchTo(cores)('select', { kind: 'activity', id: 12 })).resolves.toEqual({ reply: 'refused', reason: WHILE_RECORDING })
    await expect(dispatchTo(cores)('select', { kind: 'trail', id: 5 })).resolves.toEqual({ reply: 'refused', reason: WHILE_RECORDING })
  })

  it('refuses a trail the core made the recording\'s own, as any answer but shown', async () => {
    const cores = fakeCores()
    cores.showTrail.mockReturnValue({ kind: 'along' })
    await expect(dispatchTo(cores)('select', { kind: 'trail', id: 5 })).resolves.toEqual({ reply: 'refused', reason: WHILE_RECORDING })
  })

  it('refuses an id the list does not hold, naming only the id', async () => {
    const cores = fakeCores()
    await expect(dispatchTo(cores)('select', { kind: 'activity', id: 5 })).resolves.toEqual({ reply: 'refused', reason: 'no activity 5' })
    expect(cores.showActivity).not.toHaveBeenCalled()
  })

  it.each([{ kind: 'trail' }, { kind: 'trail', id: '5' }, { kind: 'trail', id: 1.5 }, { kind: 'route', id: 5 }, { kind: 'trail', id: 5, name: 'x' }])(
    'refuses %j, naming the arguments',
    async (args) => {
      await expect(dispatch('select', args)).resolves.toEqual({ reply: 'refused', reason: 'expected { kind: "trail" | "activity", id: <integer> }' })
    },
  )
})

describe('clear-selection', () => {
  it('clears the selection', async () => {
    const cores = fakeCores()
    await expect(dispatchTo(cores)('clear-selection')).resolves.toEqual({ reply: 'ok', data: null })
    expect(cores.clearSelection).toHaveBeenCalled()
  })

  it.each<RecordingPhase>(['recording', 'paused'])('is refused while %s', async (phase) => {
    const cores = fakeCores(phase)
    await expect(dispatchTo(cores)('clear-selection')).resolves.toEqual({ reply: 'refused', reason: WHILE_RECORDING })
    expect(cores.clearSelection).not.toHaveBeenCalled()
  })

  it('takes no arguments', async () => {
    await expect(dispatch('clear-selection', { kind: 'trail' })).resolves.toEqual({ reply: 'refused', reason: 'this hook takes no arguments' })
  })
})

describe('snapshot', () => {
  it("answers with the paths of the database's copy and the preferences it wrote", async () => {
    await expect(dispatch('snapshot')).resolves.toEqual({ reply: 'ok', data: files })
  })

  it('is a read: it answers while recording, whatever screen is in front', async () => {
    await expect(dispatchTo(fakeCores('recording'))('snapshot', {}, '/activity/save')).resolves.toEqual({ reply: 'ok', data: files })
  })

  it('takes no arguments', async () => {
    await expect(dispatch('snapshot', { name: 'x' })).resolves.toEqual({ reply: 'refused', reason: 'this hook takes no arguments' })
  })

  it('is refused with the cause when the hook folder cannot be written', async () => {
    const takeSnapshot = () => Promise.reject(new Error('the hook folder is unavailable: shared storage is not mounted'))
    await expect(dispatchTo({ ...fakeCores(), takeSnapshot })('snapshot')).resolves.toEqual({
      reply: 'refused',
      reason: 'the hook folder is unavailable: shared storage is not mounted',
    })
  })
})

// The write hooks: the phone's items as the stores hold them, edited by the cores as the app's would.
let items: { trail: { id: number; name: string }[]; activity: { id: number; name: string }[] }
let deleted: string[]
let imported: Parameters<Cores['importTrail']>[0][]

const writeCores: Cores = {
  ...fakeCores(),
  listed: (kind) => items[kind],
  deleteItem: async (kind, id) => {
    if (id === 66) throw new Error('database is locked')
    deleted.push(`${kind} ${id}`)
    items[kind] = items[kind].filter((item) => item.id !== id)
  },
  importTrail: async (request) => {
    if (request.file === 'corrupt.gpx') return { ok: false, failure: 'format' }
    imported.push(request)
    return { ok: true, id: 31 }
  },
}

const write = dispatchTo(writeCores)
const OWNER_RECORDING = 'a recording a hook did not start is live: hooks never touch it'
const ownersNames = /Croix|Morning/

beforeEach(() => {
  items = {
    trail: [
      { id: 5, name: 'DEVCHECK climb' },
      { id: 6, name: 'Col de la Croix' },
      { id: 66, name: 'DEVCHECK locked' },
    ],
    activity: [
      { id: 12, name: 'DEVCHECK walk' },
      { id: 13, name: 'Morning hike' },
    ],
  }
  deleted = []
  imported = []
})

describe('delete', () => {
  it('deletes a DEVCHECK trail or activity by its id, and names it', async () => {
    await expect(write('delete', { kind: 'trail', id: 5 })).resolves.toEqual({
      reply: 'ok',
      data: { kind: 'trail', id: 5, name: 'DEVCHECK climb' },
    })
    await expect(write('delete', { kind: 'activity', id: 12 })).resolves.toMatchObject({ reply: 'ok' })
    expect(deleted).toEqual(['trail 5', 'activity 12'])
  })

  it("refuses the owner's item without naming it", async () => {
    const answer = await write('delete', { kind: 'trail', id: 6 })
    expect(answer).toEqual({ reply: 'refused', reason: 'an item not named "DEVCHECK …": only DEVCHECK items are written' })
    expect(JSON.stringify(answer)).not.toMatch(ownersNames)
    expect(deleted).toEqual([])
  })

  it('refuses an id the app does not hold', async () => {
    await expect(write('delete', { kind: 'activity', id: 5 })).resolves.toEqual({ reply: 'refused', reason: 'no activity 5' })
  })

  it('refuses with another screen in front', async () => {
    await expect(write('delete', { kind: 'trail', id: 5 }, '/trails')).resolves.toEqual({
      reply: 'refused',
      reason: 'the map must be in front, not /trails',
    })
    expect(deleted).toEqual([])
  })

  it.each([false, true])('refuses while a recording a hook did not start is live, paused: %s', async (paused) => {
    theOwnersSession(paused)
    await expect(write('delete', { kind: 'trail', id: 5 })).resolves.toEqual({ reply: 'refused', reason: OWNER_RECORDING })
    expect(deleted).toEqual([])
  })

  it('deletes during an agent session', async () => {
    anAgentSession()
    await expect(write('delete', { kind: 'trail', id: 5 })).resolves.toMatchObject({ reply: 'ok' })
  })

  it.each([[{ kind: 'route', id: 5 }], [{ kind: 'trail' }], [{ kind: 'trail', id: '5' }], [{ kind: 'trail', id: 5.5 }]])('refuses the arguments %j', async (args) => {
    await expect(write('delete', args)).resolves.toEqual({ reply: 'refused', reason: 'expected { kind: "trail" | "activity", id: <integer> }' })
  })
})

describe('import-gpx', () => {
  const request = { file: 'import.gpx', name: 'DEVCHECK climb', difficulty: 'medium' }

  it('imports the GPX the toolkit pushed, under the name it gives, and answers its id', async () => {
    await expect(write('import-gpx', request)).resolves.toEqual({ reply: 'ok', data: { id: 31, name: 'DEVCHECK climb' } })
    expect(imported).toEqual([request])
  })

  it('refuses a name not starting with DEVCHECK before anything is written', async () => {
    const answer = await write('import-gpx', { ...request, name: 'Col de la Croix' })
    expect(answer).toEqual({ reply: 'refused', reason: 'an item not named "DEVCHECK …": only DEVCHECK items are written' })
    expect(JSON.stringify(answer)).not.toMatch(ownersNames)
    expect(imported).toEqual([])
  })

  it('refuses with another screen in front, and while recording', async () => {
    await expect(write('import-gpx', request, '/trail/new')).resolves.toMatchObject({ reason: 'the map must be in front, not /trail/new' })
    theOwnersSession()
    await expect(write('import-gpx', request)).resolves.toMatchObject({ reason: OWNER_RECORDING })
    expect(imported).toEqual([])
  })

  it('imports during an agent session', async () => {
    anAgentSession()
    await expect(write('import-gpx', request)).resolves.toMatchObject({ reply: 'ok' })
  })

  it("refuses a file the app cannot import, with the screen's reason", async () => {
    await expect(write('import-gpx', { ...request, file: 'corrupt.gpx' })).resolves.toEqual({
      reply: 'refused',
      reason: 'the GPX is not imported: This file could not be read as GPX.',
    })
  })

  it.each([
    [{ ...request, file: '../databases/onfoot.db' }, 'expected the name of a file in the hook folder'],
    [{ ...request, file: '..' }, 'expected the name of a file in the hook folder'],
    [{ ...request, file: 3 }, 'expected the name of a file in the hook folder'],
    [{ ...request, name: undefined }, 'expected a name'],
    [{ ...request, difficulty: 'Medium' }, 'expected difficulty "easy", "medium" or "hard"'],
    [{ ...request, description: 'x' }, 'unknown arguments: description'],
  ])('refuses the arguments %j', async (args, reason) => {
    await expect(write('import-gpx', args)).resolves.toEqual({ reply: 'refused', reason })
    expect(imported).toEqual([])
  })
})

describe('cleanup', () => {
  it("deletes every DEVCHECK activity, then trail, and leaves the owner's items", async () => {
    items.trail.push({ id: 7, name: 'DEVCHECK flat' }, { id: 8, name: 'DEVCHECKS mine' })
    await expect(write('cleanup')).resolves.toEqual({
      reply: 'ok',
      data: {
        deleted: [
          { kind: 'activity', id: 12, name: 'DEVCHECK walk' },
          { kind: 'trail', id: 5, name: 'DEVCHECK climb' },
          { kind: 'trail', id: 7, name: 'DEVCHECK flat' },
        ],
        failed: [{ kind: 'trail', id: 66, name: 'DEVCHECK locked', reason: 'database is locked' }],
      },
    })
    expect(items.trail.map((t) => t.name)).toEqual(['Col de la Croix', 'DEVCHECK locked', 'DEVCHECKS mine'])
    expect(items.activity.map((a) => a.name)).toEqual(['Morning hike'])
  })

  it("never names the owner's items", async () => {
    expect(JSON.stringify(await write('cleanup'))).not.toMatch(ownersNames)
  })

  it('answers nothing deleted when no DEVCHECK item is left', async () => {
    items = { trail: [{ id: 6, name: 'Col de la Croix' }], activity: [] }
    await expect(write('cleanup')).resolves.toEqual({ reply: 'ok', data: { deleted: [], failed: [] } })
  })

  it('refuses with another screen in front, and while recording', async () => {
    await expect(write('cleanup', {}, '/activities')).resolves.toMatchObject({ reason: 'the map must be in front, not /activities' })
    theOwnersSession(true)
    await expect(write('cleanup')).resolves.toMatchObject({ reason: OWNER_RECORDING })
    expect(deleted).toEqual([])
  })

  it('takes no arguments', async () => {
    await expect(write('cleanup', { kind: 'trail' })).resolves.toEqual({ reply: 'refused', reason: 'this hook takes no arguments' })
  })
})

describe('record-start', () => {
  it('starts a recording and keeps it as the agent session', async () => {
    await expect(dispatch('record-start')).resolves.toEqual({ reply: 'ok', data: { sessionId: 42 } })
    expect(kept).toBe(42)
  })

  it.each([
    ['already-active', 'a recording is already live'],
    ['permission-missing', 'location access "All the time" is missing; grant it on the phone'],
    ['location-off', 'location is off; turn it on'],
    ['app-behind', 'On Foot is not in front'],
  ] as const)('refuses rather than prompts: %s', async (outcome, reason) => {
    jest.mocked(cores.startRecording).mockResolvedValue(outcome)
    await expect(dispatch('record-start')).resolves.toEqual({ reply: 'refused', reason })
    expect(kept).toBeNull()
  })

  it('refuses with another screen in front', async () => {
    await expect(dispatch('record-start', {}, '/trails')).resolves.toEqual({
      reply: 'refused',
      reason: 'the map must be in front, not /trails',
    })
    expect(cores.startRecording).not.toHaveBeenCalled()
  })
})

describe('the hooks on an agent session', () => {
  it('pauses it', async () => {
    anAgentSession()
    await expect(dispatch('record-pause')).resolves.toEqual({ reply: 'ok', data: { sessionId: 42 } })
    expect(calls).toEqual(['pause'])
  })

  it('resumes it', async () => {
    anAgentSession(true)
    await expect(dispatch('record-resume')).resolves.toEqual({ reply: 'ok', data: { sessionId: 42 } })
    expect(calls).toEqual(['resume'])
  })

  it('refuses a resume rather than prompts', async () => {
    anAgentSession(true)
    jest.mocked(cores.resumeRecording).mockResolvedValue('location-off')
    await expect(dispatch('record-resume')).resolves.toEqual({ reply: 'refused', reason: 'location is off; turn it on' })
  })

  it('discards it and forgets it', async () => {
    anAgentSession()
    await expect(dispatch('record-discard')).resolves.toEqual({ reply: 'ok', data: { sessionId: 42 } })
    expect(calls).toEqual(['discard 42'])
    expect(kept).toBeNull()
  })

  it('saves it paused, the trail followed linked first, and forgets it', async () => {
    anAgentSession(true)
    await expect(dispatch('record-save', { name: 'DEVCHECK climb', effort: 'hard' })).resolves.toEqual({
      reply: 'ok',
      data: { sessionId: 42, activityId: 31 },
    })
    expect(calls).toEqual(['stop for save', 'load', 'save 42'])
    expect(cores.saveRecording).toHaveBeenCalledWith(expect.anything(), { name: 'DEVCHECK climb', effort: 'hard', comments: null })
    expect(kept).toBeNull()
  })

  it('saves only a paused session', async () => {
    anAgentSession()
    await expect(dispatch('record-save', { name: 'DEVCHECK climb', effort: 'easy' })).resolves.toEqual({
      reply: 'refused',
      reason: 'only a paused agent session is saved; pause it first',
    })
    expect(calls).toEqual([])
  })

  it('saves only under a DEVCHECK name, never quoting it', async () => {
    anAgentSession(true)
    const answer = await dispatch('record-save', { name: 'Mont Blanc', effort: 'easy' })
    expect(answer).toEqual({ reply: 'refused', reason: 'an item not named "DEVCHECK …": only DEVCHECK items are written' })
    expect(calls).toEqual([])
  })

  it.each([
    [{ effort: 'easy' }, 'name must be a string'],
    [{ name: 'DEVCHECK climb', effort: 'brutal' }, 'effort must be one of easy, moderate, hard, max'],
    [{ name: 'DEVCHECK climb', effort: 'easy', comments: 'x' }, 'unknown arguments: comments'],
  ])('refuses a save with malformed arguments: %j', async (args, reason) => {
    anAgentSession(true)
    await expect(dispatch('record-save', args)).resolves.toEqual({ reply: 'refused', reason })
  })

  it('refuses a save whose session ended under it', async () => {
    anAgentSession(true)
    jest.mocked(cores.loadRecording).mockResolvedValue(null)
    await expect(dispatch('record-save', { name: 'DEVCHECK climb', effort: 'easy' })).resolves.toEqual({
      reply: 'refused',
      reason: 'the agent session ended before its save',
    })
    expect(kept).toBe(42)
  })
})

describe('every recording hook but start', () => {
  const hooks: [string, Record<string, unknown>][] = [
    ['record-pause', {}],
    ['record-resume', {}],
    ['record-discard', {}],
    ['record-save', { name: 'DEVCHECK climb', effort: 'easy' }],
  ]

  it.each(hooks)('%s refuses a recording a hook did not start', async (name, args) => {
    theOwnersSession(true)
    await expect(dispatch(name, args)).resolves.toEqual({
      reply: 'refused',
      reason: 'a recording a hook did not start is live: hooks never touch it',
    })
    expect(calls).toEqual([])
  })

  it.each(hooks)('%s refuses a session that only shares a kept id that ended', async (name, args) => {
    live = { id: 43, paused: true }
    kept = 42
    await expect(dispatch(name, args)).resolves.toMatchObject({ reply: 'refused' })
    expect(calls).toEqual([])
  })

  it.each(hooks)('%s refuses with no recording live', async (name, args) => {
    kept = 42
    await expect(dispatch(name, args)).resolves.toEqual({ reply: 'refused', reason: 'no recording is live' })
  })

  it.each(hooks)('%s refuses with the save form in front', async (name, args) => {
    anAgentSession(true)
    await expect(dispatch(name, args, '/activity/save')).resolves.toEqual({
      reply: 'refused',
      reason: 'the map must be in front, not /activity/save',
    })
    expect(calls).toEqual([])
  })
})
