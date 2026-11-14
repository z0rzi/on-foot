import * as fs from 'node:fs'
import * as path from 'node:path'

export function readRepoText(file: string, rootDir: string = process.cwd()): string {
  return fs.readFileSync(path.join(rootDir, file), 'utf8')
}

export function readRepoJson<T>(file: string, rootDir: string = process.cwd()): T {
  return JSON.parse(readRepoText(file, rootDir)) as T
}
