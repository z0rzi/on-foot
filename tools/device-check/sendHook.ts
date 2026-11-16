import type { Broadcast, HookReply } from './hookReply'

export interface HookIo {
  broadcast(hook: string, args: Record<string, unknown>): Promise<Broadcast>
  launch(): Promise<void>
  // Whether On Foot's activity is the one resumed.
  onFootInFront(): Promise<boolean>
  sleep(ms: number): Promise<void>
  now(): number
}

const READY_BOUND_MS = 30_000
// From On Foot in front to its dispatcher listening: the JS loading and its first render. A build
// with hooks registers its receiver by then; one without never does.
const RECEIVER_GRACE_MS = 10_000
const POLL_MS = 1_000

export const NO_HOOKS = 'no check-hook dispatcher answered, even with On Foot launched and in front: the installed build has no check hooks; build it with `devcheck build`'
export const NO_REPLY = 'On Foot gave no reply within its deadline; the hook may have run: read `devcheck state`'
const NOT_IN_FRONT = `On Foot did not come to the front within ${READY_BOUND_MS / 1000} s of its launch (screen off or locked?)`

type Answer = Exclude<HookReply, { reply: 'not-ready' }>

// The installed build answers no hook: it was made without the flag, or before hooks.
export class NoHooks extends Error {}

// Why a broadcast left the hook unanswered, once the wait is over.
function unanswered(b: Broadcast): Error {
  if (b.kind === 'no-dispatcher') return new NoHooks(NO_HOOKS)
  if (b.kind === 'no-reply') return new Error(NO_REPLY)
  const loading = b.reply.reply === 'not-ready' ? b.reply.loading.join(', ') : 'nothing'
  return new Error(`On Foot was not ready within ${READY_BOUND_MS / 1000} s: still loading ${loading}`)
}

// Polls `state` until the app answers it, never reading the screen; bounded. After a launch, a
// missing dispatcher counts only once On Foot is in front, and then fails within the grace.
async function untilReady(io: HookIo, launched: boolean): Promise<void> {
  const deadline = io.now() + READY_BOUND_MS
  let receiverBy = launched ? null : Infinity
  for (;;) {
    if (receiverBy === null) {
      if (await io.onFootInFront()) receiverBy = io.now() + RECEIVER_GRACE_MS
      else if (io.now() >= deadline) throw new Error(NOT_IN_FRONT)
      else {
        await io.sleep(POLL_MS)
        continue
      }
    }
    const state = await io.broadcast('state', {})
    if (state.kind === 'no-reply') throw unanswered(state)
    if (state.kind === 'reply' && state.reply.reply !== 'not-ready') return
    if (io.now() >= deadline || (state.kind === 'no-dispatcher' && io.now() >= receiverBy)) throw unanswered(state)
    await io.sleep(POLL_MS)
  }
}

const isAnswer = (b: Broadcast): b is { kind: 'reply'; reply: Answer } => b.kind === 'reply' && b.reply.reply !== 'not-ready'

// One hook, answered `ok` or `refused`. With no dispatcher it launches On Foot, and while the app
// loads it waits on `state`, then sends the hook once more.
export async function sendHook(hook: string, args: Record<string, unknown>, io: HookIo): Promise<Answer> {
  const first = await io.broadcast(hook, args)
  if (isAnswer(first)) return first.reply
  if (first.kind === 'no-reply') throw unanswered(first)
  const launched = first.kind === 'no-dispatcher'
  if (launched) await io.launch()
  await untilReady(io, launched)
  const again = await io.broadcast(hook, args)
  if (isAnswer(again)) return again.reply
  throw unanswered(again)
}
