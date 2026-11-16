import { errorClass, logEvent } from '../log'
import { refusalOf, type AppView, type Hook } from './hook'
import { replyText, type HookReply } from './reply'

// A hook as the receiver hands it over: its name and its arguments as JSON.
interface HookRequest {
  hook: string
  args: string
}

interface DispatchContext<C> {
  hooks: Record<string, Hook<C>>
  cores: C
  app: () => AppView
}

type Outcome = HookReply['reply'] | 'busy' | 'failed'

const log = (name: string, outcome: Outcome, detail?: Record<string, unknown>) =>
  logEvent(outcome === 'failed' ? 'warn' : 'info', 'hooks', `hook ${name} ${outcome}`, ...(detail ? [detail] : []))

function argumentsOf(json: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(json)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// Every request gets one reply and one `hooks` line; nothing it does throws. Hooks run one at a time.
export function createDispatcher<C>({ hooks, cores, app }: DispatchContext<C>) {
  let running = false
  return async function dispatch({ hook: name, args }: HookRequest): Promise<HookReply> {
    const hook = Object.hasOwn(hooks, name) ? hooks[name] : undefined
    if (!hook) {
      log('(unknown)', 'refused')
      return { reply: 'refused', reason: `unknown hook "${name}"` }
    }
    if (running) {
      log(name, 'busy')
      return { reply: 'refused', reason: 'busy: another hook is running; send it again' }
    }
    const view = app()
    if (view.loading.length > 0) {
      log(name, 'not-ready')
      return { reply: 'not-ready', loading: view.loading }
    }
    const parsed = argumentsOf(args)
    if (!parsed) {
      log(name, 'refused')
      return { reply: 'refused', reason: 'the arguments are not a JSON object' }
    }
    running = true
    try {
      const answer = await hook.answer(parsed, view, cores)
      log(name, answer.reply)
      return answer
    } catch (error) {
      log(name, 'failed', { errorClass: errorClass(error) })
      return refusalOf(error)
    } finally {
      running = false
    }
  }
}

// A throw of the receiver's reply reaches neither adb, whose broadcast ends at its deadline, nor
// the dispatcher, which has answered: only the log learns of it.
export async function deliverReply(answer: Promise<HookReply>, deliver: (text: string) => void): Promise<void> {
  const reply = await answer
  try {
    deliver(replyText(reply))
  } catch (error) {
    logEvent('warn', 'hooks', 'hook reply failed', { errorClass: errorClass(error) })
  }
}
