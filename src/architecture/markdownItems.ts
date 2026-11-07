import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'yaml'

/** A markdown file under a folder of items, `path` relative to that folder. */
export interface ItemFile {
  path: string
  content: string
}

export interface ItemViolation {
  file: string
  problem: string
}

type Report = (problem: string) => void
type Fields = Record<string, unknown>
/** `null` in an enum admits an empty value. */
type Enums = Record<string, (string | null)[]>

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/
const WIKILINK = /^\[\[([^\]]+)\]\]$/

export function collectMarkdownFiles(dir: string, rootDir: string = process.cwd()): ItemFile[] {
  const abs = path.join(rootDir, dir)
  if (!fs.existsSync(abs)) throw new Error(`folder ${dir} is missing`)
  const files: ItemFile[] = []
  const walk = (sub: string) => {
    for (const entry of fs.readdirSync(path.join(abs, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(rel)
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({ path: rel, content: fs.readFileSync(path.join(abs, rel), 'utf8') })
      }
    }
  }
  walk('')
  return files
}

/** Splits a file into its frontmatter map and body, reporting why when it cannot. */
export function readFrontmatter(content: string, report: Report): { fields: Fields; body: string } | undefined {
  const fm = FRONTMATTER.exec(content)
  if (!fm) {
    report('no frontmatter block')
    return undefined
  }
  let data: unknown
  try {
    data = parse(fm[1])
  } catch (err) {
    report(`frontmatter is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : err}`)
    return undefined
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    report('frontmatter is not a key/value map')
    return undefined
  }
  return { fields: data as Fields, body: content.slice(fm[0].length) }
}

export function checkKeys(fields: Fields, keys: readonly string[], report: Report): void {
  for (const key of Object.keys(fields)) {
    if (!keys.includes(key)) report(`unknown frontmatter key ${key}`)
  }
  for (const key of keys) {
    if (!(key in fields)) report(`missing frontmatter key ${key}`)
  }
}

export function checkEnums(fields: Fields, enums: Enums, report: Report): void {
  for (const [key, allowed] of Object.entries(enums)) {
    if (key in fields && !allowed.includes(fields[key] as string | null)) {
      const shown = allowed.map((v) => v ?? '(empty)').join(' | ')
      report(`${key} is ${JSON.stringify(fields[key])}, expected ${shown}`)
    }
  }
}

/** A list field of `[[wikilinks]]`, each resolving to a name in `known`. */
export function checkLinks(
  fields: Fields,
  key: string,
  known: ReadonlySet<string>,
  describe: string,
  report: Report,
): void {
  if (!(key in fields)) return
  const links = fields[key]
  if (!Array.isArray(links)) {
    report(`${key} must be a list`)
    return
  }
  for (const entry of links) {
    const target = typeof entry === 'string' ? WIKILINK.exec(entry)?.[1] : undefined
    if (!target) report(`${key} entry ${JSON.stringify(entry)} is not a [[wikilink]]`)
    else if (!known.has(target)) report(`${key} links [[${target}]], which is not ${describe}`)
  }
}

export function checkHeading(body: string, id: string, report: Report): void {
  const heading = /^# (.*)$/m.exec(body)?.[1]
  if (!heading?.startsWith(`${id}: `)) report(`first heading must start with "# ${id}: "`)
}
