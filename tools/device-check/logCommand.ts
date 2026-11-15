import { readFileSync, statSync } from 'node:fs'
import { serial } from './adb'
import { captureReport } from './capture'
import { capturePath } from './phoneStore'

// The debug log as the recorder keeps it, every process of On Foot since the check's first command.
// An empty capture's modification time is its creation, when the recording began.
export async function readLog(areas: string[]): Promise<string> {
  const path = capturePath(await serial())
  return captureReport(readFileSync(path, 'utf8'), areas, statSync(path).mtime, path)
}
