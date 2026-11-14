import * as fs from 'node:fs'
import * as path from 'node:path'

export interface SourceFile {
  path: string
  content: string
}

const SOURCE_EXT = /\.tsx?$/
const TEST_FILE = /\.(test|spec)\.tsx?$/
const SKIPPED_DIRS = new Set(['__tests__', 'build', 'node_modules'])

// The app's own source, then with the agent tooling under tools/ for the gates that read code shape
// alone (docs/architecture/seams.md says which).
const APP_ROOTS = ['src', 'app', 'modules']
export const APP_AND_TOOLING_ROOTS = [...APP_ROOTS, 'tools']

export function collectSourceFiles(
  roots: string[] = APP_ROOTS,
  rootDir: string = process.cwd(),
): SourceFile[] {
  const out: SourceFile[] = []
  const walk = (abs: string, rel: string) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue
        walk(path.join(abs, entry.name), `${rel}/${entry.name}`)
      } else if (entry.isFile() && SOURCE_EXT.test(entry.name) && !TEST_FILE.test(entry.name)) {
        out.push({ path: `${rel}/${entry.name}`, content: fs.readFileSync(path.join(abs, entry.name), 'utf8') })
      }
    }
  }
  for (const root of roots) {
    const abs = path.join(rootDir, root)
    if (fs.existsSync(abs)) walk(abs, root)
  }
  return out
}
