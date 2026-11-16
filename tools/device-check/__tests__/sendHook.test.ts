import type { Broadcast } from '../hookReply'
import { NO_HOOKS, NO_REPLY, NoHooks, sendHook, type HookIo } from '../sendHook'

const ok = (data: unknown): Broadcast => ({ kind: 'reply', reply: { reply: 'ok', data } })
const notReady = (...loading: string[]): Broadcast => ({ kind: 'reply', reply: { reply: 'not-ready', loading } })
const none: Broadcast = { kind: 'no-dispatcher' }

// A phone that answers each broadcast with the next scripted result, on a clock the waits move.
// On Foot comes to the front at `inFrontAt` on that clock, once launched.
function phone(script: Broadcast[], inFrontAt = 0) {
  const sent: string[] = []
  let launches = 0
  let clock = 0
  const io: HookIo = {
    onFootInFront: async () => launches > 0 && clock >= inFrontAt,
    broadcast: async (hook) => {
      sent.push(hook)
      const next = script.shift()
      if (!next) throw new Error('no more scripted broadcasts')
      return next
    },
    launch: async () => {
      launches++
    },
    sleep: async (ms) => {
      clock += ms
    },
    now: () => clock,
  }
  return { io, sent, launches: () => launches, clock: () => clock }
}

describe('a hook sent to the app', () => {
  it("is answered at once when the app's dispatcher is ready", async () => {
    const p = phone([ok({ id: 3 })])
    await expect(sendHook('list', {}, p.io)).resolves.toEqual({ reply: 'ok', data: { id: 3 } })
    expect(p.sent).toEqual(['list'])
    expect(p.launches()).toBe(0)
  })

  it('passes a refusal through', async () => {
    const p = phone([{ kind: 'reply', reply: { reply: 'refused', reason: 'the map must be in front, not /settings' } }])
    await expect(sendHook('cleanup', {}, p.io)).resolves.toEqual({ reply: 'refused', reason: 'the map must be in front, not /settings' })
  })

  it('launches On Foot when no dispatcher answers, waits on state, then sends the hook again', async () => {
    const p = phone([none, none, notReady('launch'), notReady('trails'), ok({}), ok({ id: 3 })])
    await expect(sendHook('list', {}, p.io)).resolves.toEqual({ reply: 'ok', data: { id: 3 } })
    expect(p.launches()).toBe(1)
    expect(p.sent).toEqual(['list', 'state', 'state', 'state', 'state', 'list'])
  })

  it('waits on state without launching while the app loads', async () => {
    const p = phone([notReady('offline packs'), ok({}), ok({ id: 3 })])
    await expect(sendHook('list', {}, p.io)).resolves.toEqual({ reply: 'ok', data: { id: 3 } })
    expect(p.launches()).toBe(0)
  })

  it('points at a build with hooks soon after On Foot is in front with no dispatcher', async () => {
    const p = phone(Array.from({ length: 40 }, () => none), 4_000)
    const sent = sendHook('state', {}, p.io)
    await expect(sent).rejects.toThrow(NO_HOOKS)
    await expect(sent).rejects.toBeInstanceOf(NoHooks)
    expect(p.clock()).toBeLessThanOrEqual(4_000 + 10_000)
  })

  it('waits for On Foot in front before it counts a missing dispatcher', async () => {
    const p = phone([none, none, none, notReady('launch'), ok({}), ok({ id: 3 })], 25_000)
    await expect(sendHook('list', {}, p.io)).resolves.toEqual({ reply: 'ok', data: { id: 3 } })
    expect(p.sent).toEqual(['list', 'state', 'state', 'state', 'state', 'list'])
  })

  it('fails when On Foot never comes to the front after its launch', async () => {
    const p = phone([none], Infinity)
    await expect(sendHook('list', {}, p.io)).rejects.toThrow('On Foot did not come to the front within 30 s of its launch (screen off or locked?)')
    expect(p.sent).toEqual(['list'])
  })

  it('names what still loads when the app is not ready in time', async () => {
    const p = phone([notReady('trails'), ...Array.from({ length: 40 }, () => notReady('trails', 'recording'))])
    await expect(sendHook('list', {}, p.io)).rejects.toThrow('On Foot was not ready within 30 s: still loading trails, recording')
  })

  it('fails on a reply the deadline closed, saying the hook may have run', async () => {
    const p = phone([{ kind: 'no-reply' }])
    await expect(sendHook('cleanup', {}, p.io)).rejects.toThrow(NO_REPLY)
  })
})
