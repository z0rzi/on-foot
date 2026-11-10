import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')

const pad = (n: number) => String(n).padStart(2, '0')

export function evidenceDir(now = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const dir = join(REPO_ROOT, '.scratch', 'device-checks', date)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function nextShotNumber(fileNames: string[]): number {
  const numbers = fileNames.map((f) => /^(\d{2,})-/.exec(f)).filter((m) => m !== null).map((m) => Number(m[1]))
  return Math.max(0, ...numbers) + 1
}

export function slug(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function shotBase(n: number, name: string): string {
  return `${pad(n)}-${slug(name)}`
}

export function nextShotBase(dir: string, name: string): string {
  return shotBase(nextShotNumber(readdirSync(dir)), name)
}
