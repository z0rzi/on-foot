import { createSerialQueue } from '../async/serialQueue'
import { LogArea, LogLevel, logRepository } from '../data/log'
import { encodeDetail } from '../data/log/mapping'
import { logcatLine } from './logcatLine'
import { toLogcat } from './logcatSink'

// The log's own queue, not the recording chain's: a log write must never wait behind a recording
// turn, nor hold one up.
const queue = createSerialQueue()
let pending: Promise<unknown> = Promise.resolve()

export function logEvent(
  level: LogLevel,
  area: LogArea,
  message: string,
  detail?: Record<string, unknown>,
): void {
  const entry = { t: Date.now(), level, area, message, detail: encodeDetail(detail) }
  toLogcat(logcatLine(entry))
  pending = queue(() => logRepository.append(entry)).catch(() => {})
}

// Tests await the queue; nothing in the app does.
export function flushLog(): Promise<void> {
  return pending.then(() => undefined)
}
