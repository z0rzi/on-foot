jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import { logEvent } from '../../log'
import { createDispatcher, deliverReply } from '../dispatcher'
import { devcheckOnly, hook, mapInFront, noOwnerRecording, ok, refused, type AppView, type LiveSession } from '../hook'
import type { Loading } from '../reply'

interface FakeCores {
  trailName(id: number): Promise<string | null>
  deleteTrail(id: number): Promise<'deleted' | 'gone'>
  slow(): Promise<string>
  liveSession(): LiveSession | null
  agentSession: { read(): Promise<number | null> }
}

const deleted: number[] = []
let releaseSlow: (value: string) => void = () => {}
let live: LiveSession | null = null
let agentSessionId: number | null = null

const cores: FakeCores = {
  trailName: async (id) => ({ 1: 'DEVCHECK climb', 2: 'Col de la Croix' } as Record<number, string>)[id] ?? null,
  deleteTrail: async (id) => {
    if (id === 3) return 'gone'
    deleted.push(id)
    return 'deleted'
  },
  slow: () => new Promise((resolve) => (releaseSlow = resolve)),
  liveSession: () => live,
  agentSession: { read: async () => agentSessionId },
}

const trailId = (args: Record<string, unknown>): { id: number } => {
  if (typeof args.id !== 'number') throw new Error('expected a numeric id')
  return { id: args.id }
}

const HOOKS = {
  ping: hook<object, FakeCores>({
    parse: () => ({}),
    guards: [],
    run: (_args, _cores, app) => ok({ screen: app.screen }),
  }),
  'delete-trail': hook<{ id: number }, FakeCores>({
    parse: trailId,
    guards: [mapInFront, noOwnerRecording, devcheckOnly(async ({ id }, c) => [(await c.trailName(id)) ?? `DEVCHECK #${id}`])],
    run: async ({ id }, c) => ((await c.deleteTrail(id)) === 'deleted' ? ok({ id }) : refused(`no trail ${id}`)),
  }),
  slow: hook<object, FakeCores>({
    parse: () => ({}),
    guards: [],
    run: async (_args, c) => ok(await c.slow()),
  }),
  broken: hook<object, FakeCores>({
    parse: () => ({}),
    guards: [],
    run: () => {
      throw new TypeError('disk full')
    },
  }),
}

let view: AppView
const dispatch = (hookName: string, args: unknown = {}) =>
  createDispatcherUnderTest()({ hook: hookName, args: JSON.stringify(args) })

let dispatcher: ReturnType<typeof createDispatcher<FakeCores>> | null = null
function createDispatcherUnderTest() {
  dispatcher ??= createDispatcher({ hooks: HOOKS, cores, app: () => view })
  return dispatcher
}

beforeEach(() => {
  jest.mocked(logEvent).mockClear()
  deleted.length = 0
  live = null
  agentSessionId = null
  dispatcher = null
  view = { screen: '/', loading: [] }
})

describe('a hook the app knows', () => {
  it('answers ok with its data', async () => {
    view = { screen: '/trails', loading: [] }
    await expect(dispatch('ping')).resolves.toEqual({ reply: 'ok', data: { screen: '/trails' } })
  })

  it('passes a core refusal through', async () => {
    await expect(dispatch('delete-trail', { id: 3 })).resolves.toEqual({ reply: 'refused', reason: 'no trail 3' })
  })

  it('answers a core that throws with its message, and the app keeps answering', async () => {
    await expect(dispatch('broken')).resolves.toEqual({ reply: 'refused', reason: 'disk full' })
    await expect(dispatch('ping')).resolves.toMatchObject({ reply: 'ok' })
  })
})

describe('what the dispatcher refuses itself', () => {
  it('refuses an unknown hook, naming it', async () => {
    await expect(dispatch('format-disk')).resolves.toEqual({ reply: 'refused', reason: 'unknown hook "format-disk"' })
  })

  it('refuses arguments that are not a JSON object', async () => {
    const answer = createDispatcherUnderTest()
    await expect(answer({ hook: 'ping', args: '{"id":' })).resolves.toEqual({ reply: 'refused', reason: 'the arguments are not a JSON object' })
    await expect(answer({ hook: 'ping', args: '[1]' })).resolves.toEqual({ reply: 'refused', reason: 'the arguments are not a JSON object' })
  })

  it('refuses arguments the hook cannot read, with its reason', async () => {
    await expect(dispatch('delete-trail', { id: 'one' })).resolves.toEqual({ reply: 'refused', reason: 'expected a numeric id' })
  })

  it('refuses a hook while another runs, then answers the next one', async () => {
    const first = dispatch('slow')
    await expect(dispatch('ping')).resolves.toEqual({ reply: 'refused', reason: 'busy: another hook is running; send it again' })
    releaseSlow('done')
    await expect(first).resolves.toEqual({ reply: 'ok', data: 'done' })
    await expect(dispatch('ping')).resolves.toMatchObject({ reply: 'ok' })
  })
})

describe('readiness', () => {
  const stillLoading: { loading: Loading[] }[] = [
    { loading: ['launch'] },
    { loading: ['trails', 'activities'] },
    { loading: ['offline packs'] },
    { loading: ['recording'] },
  ]
  it.each(stillLoading)(
    'answers not-ready with what still loads: $loading',
    async ({ loading }) => {
      view = { screen: '/', loading }
      await expect(dispatch('ping')).resolves.toEqual({ reply: 'not-ready', loading })
    },
  )

  it('runs nothing before the app is ready', async () => {
    view = { screen: '/', loading: ['trails'] }
    await dispatch('delete-trail', { id: 1 })
    expect(deleted).toEqual([])
  })
})

describe('the guards', () => {
  it('refuses a write unless the map is in front, naming the screen', async () => {
    view = { screen: '/activity/save', loading: [] }
    await expect(dispatch('delete-trail', { id: 1 })).resolves.toEqual({
      reply: 'refused',
      reason: 'the map must be in front, not /activity/save',
    })
    expect(deleted).toEqual([])
  })

  it('refuses a write on an item not named DEVCHECK, without quoting its name', async () => {
    const answer = await dispatch('delete-trail', { id: 2 })
    expect(answer).toEqual({ reply: 'refused', reason: 'an item not named "DEVCHECK …": only DEVCHECK items are written' })
    expect(JSON.stringify(answer)).not.toContain('Croix')
    expect(deleted).toEqual([])
  })

  it('refuses a write while a recording a hook did not start is live', async () => {
    live = { id: 40, paused: true }
    agentSessionId = 39
    await expect(dispatch('delete-trail', { id: 1 })).resolves.toEqual({
      reply: 'refused',
      reason: 'a recording a hook did not start is live: hooks never touch it',
    })
    expect(deleted).toEqual([])
  })

  it('runs a write during an agent session', async () => {
    live = { id: 42, paused: false }
    agentSessionId = 42
    await expect(dispatch('delete-trail', { id: 1 })).resolves.toEqual({ reply: 'ok', data: { id: 1 } })
    expect(deleted).toEqual([1])
  })

  it('runs a write on a DEVCHECK item with the map in front', async () => {
    await expect(dispatch('delete-trail', { id: 1 })).resolves.toEqual({ reply: 'ok', data: { id: 1 } })
    expect(deleted).toEqual([1])
  })
})

describe('the debug log', () => {
  const lines = () => jest.mocked(logEvent).mock.calls

  it('writes one hooks line per hook, its name and outcome and no data', async () => {
    await dispatch('ping')
    await dispatch('delete-trail', { id: 2 })
    view = { screen: '/', loading: ['launch'] }
    await dispatch('ping')
    expect(lines()).toEqual([
      ['info', 'hooks', 'hook ping ok'],
      ['info', 'hooks', 'hook delete-trail refused'],
      ['info', 'hooks', 'hook ping not-ready'],
    ])
  })

  it('names neither an unknown hook nor what a busy one asked', async () => {
    await dispatch('format-disk')
    const first = dispatch('slow')
    await dispatch('ping')
    releaseSlow('done')
    await first
    expect(lines()).toEqual([
      ['info', 'hooks', 'hook (unknown) refused'],
      ['info', 'hooks', 'hook ping busy'],
      ['info', 'hooks', 'hook slow ok'],
    ])
  })

  it('logs arguments it cannot read as refused, not failed', async () => {
    await dispatch('delete-trail', { id: 'one' })
    expect(lines()).toEqual([['info', 'hooks', 'hook delete-trail refused']])
  })

  it('logs a throw as failed with its class', async () => {
    await dispatch('broken')
    expect(lines()).toEqual([['warn', 'hooks', 'hook broken failed', { errorClass: 'TypeError' }]])
  })
})

describe('the reply handed to the receiver', () => {
  it('is the answer as the toolkit reads it', async () => {
    const delivered: string[] = []
    await deliverReply(dispatch('ping'), (text) => delivered.push(text))
    expect(delivered).toEqual(['{"reply":"ok","data":{"screen":"/"}}'])
  })

  it('logs a receiver that throws on it, with its class, as no one else learns of it', async () => {
    await expect(
      deliverReply(dispatch('ping'), () => {
        throw new RangeError('no pending broadcast')
      }),
    ).resolves.toBeUndefined()
    expect(jest.mocked(logEvent).mock.calls).toEqual([
      ['info', 'hooks', 'hook ping ok'],
      ['warn', 'hooks', 'hook reply failed', { errorClass: 'RangeError' }],
    ])
  })
})
