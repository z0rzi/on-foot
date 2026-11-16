import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { adb, quote, shell, TIMEOUT } from './adb'
import { EVIDENCE_ROOT, evidenceDir } from './evidence'
import { hookData } from './hookData'
import { HOOK_FOLDER } from './phoneState'
import { isSnapshotFile, pulledNames, snapshotFiles } from './snapshotFiles'

// The app's database and preferences pulled into the evidence folder, then deleted on the phone,
// pulled or not: the owner's trails and tracks never stay in the hook folder.
export async function snapshot(): Promise<string> {
  const onPhone = snapshotFiles(await hookData('snapshot'))
  const dir = evidenceDir()
  const names = pulledNames(readdirSync(dir))
  const pulled = { database: join(dir, names.database), preferences: join(dir, names.preferences) }
  try {
    await adb(['pull', onPhone.database, pulled.database], TIMEOUT.pull)
    await adb(['pull', onPhone.preferences, pulled.preferences], TIMEOUT.pull)
  } finally {
    await shell(`rm -f ${quote(onPhone.database)} ${quote(onPhone.preferences)}`)
  }
  return [`database: ${pulled.database}`, `preferences: ${pulled.preferences}`, 'deleted on the phone; `cleanup` deletes them here'].join('\n')
}

function evidenceSnapshots(): string[] {
  if (!existsSync(EVIDENCE_ROOT)) return []
  return readdirSync(EVIDENCE_ROOT)
    .map((day) => join(EVIDENCE_ROOT, day))
    .filter((dir) => statSync(dir).isDirectory())
    .flatMap((dir) => readdirSync(dir).filter(isSnapshotFile).map((name) => join(dir, name)))
}

// Cleanup's part for snapshots: every one in the evidence folders deleted, and the hook folder
// emptied, the GPX files pushed for an import included.
export async function clearSnapshots(): Promise<string> {
  const found = evidenceSnapshots()
  for (const path of found) rmSync(path, { force: true })
  await shell(`rm -rf ${quote(HOOK_FOLDER)}/*`)
  return `snapshot files deleted from the evidence: ${found.length}; hook folder emptied`
}
