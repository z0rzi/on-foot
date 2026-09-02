import * as fs from 'node:fs'
import * as path from 'node:path'

export interface SourceFile {
  path: string
  content: string
}

const SOURCE_EXT = /\.tsx?$/
const TEST_FILE = /\.(test|spec)\.tsx?$/

export function collectSourceFiles(
  roots: string[] = ['src', 'app'],
  rootDir: string = process.cwd(),
): SourceFile[] {
  const out: SourceFile[] = []
  const walk = (abs: string, rel: string) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue
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
