import { SourceFile } from './sourceScan'

// Reports runs of identical *significant* lines (blank, comment, import and punctuation-only
// lines do not count) of at least DUPLICATION_WINDOW, across files or within one. Identifiers
// are not normalised on purpose: a copy that renames every symbol (trail -> activity) is
// invisible here and is caught by the spec's "Existing shape" step and POST-WORK's sibling
// check instead. Window calibration: 8 reports nothing on the post-health-check tree and five
// of the 2026-09-07 findings on the tree before it.
export const DUPLICATION_WINDOW = 8

export interface DuplicateExemption {
  path: string
  rationale: string
}

export const DUPLICATION_EXEMPT: DuplicateExemption[] = []

export interface CodeLocation {
  file: string
  startLine: number
  endLine: number
}

export interface DuplicateBlock {
  a: CodeLocation
  b: CodeLocation
  lines: number
}

export interface SignificantLine {
  line: number
  text: string
}

const PUNCTUATION_ONLY = /^[\s{}()[\];,]*$/
const COMMENT = /^(\/\/|\/\*|\*)/
const IMPORT_OR_REEXPORT = /^(import\b|export\s.*\sfrom\s)/

export function significantLines(content: string): SignificantLine[] {
  const out: SignificantLine[] = []
  content.split('\n').forEach((raw, index) => {
    const text = raw.trim()
    if (!text || PUNCTUATION_ONLY.test(text) || COMMENT.test(text) || IMPORT_OR_REEXPORT.test(text)) return
    out.push({ line: index + 1, text })
  })
  return out
}

interface Occurrence {
  file: string
  index: number
  lines: SignificantLine[]
}

interface Run {
  a: Occurrence
  b: Occurrence
  length: number
}

const location = (o: Occurrence, length: number): CodeLocation => ({
  file: o.file,
  startLine: o.lines[o.index].line,
  endLine: o.lines[o.index + length - 1].line,
})

const compareLocations = (x: CodeLocation, y: CodeLocation): number =>
  x.file.localeCompare(y.file) || x.startLine - y.startLine

export function findDuplicateBlocks(
  files: SourceFile[],
  window: number = DUPLICATION_WINDOW,
  exempt: DuplicateExemption[] = DUPLICATION_EXEMPT,
): DuplicateBlock[] {
  const byKey = new Map<string, Occurrence[]>()
  for (const file of files) {
    if (exempt.some((e) => file.path.startsWith(e.path))) continue
    const lines = significantLines(file.content)
    for (let index = 0; index + window <= lines.length; index++) {
      const key = lines
        .slice(index, index + window)
        .map((l) => l.text)
        .join('\n')
      const list = byKey.get(key) ?? []
      list.push({ file: file.path, index, lines })
      byKey.set(key, list)
    }
  }

  const pairsByFiles = new Map<string, [Occurrence, Occurrence][]>()
  for (const occurrences of byKey.values()) {
    if (occurrences.length < 2) continue
    for (let x = 0; x < occurrences.length; x++) {
      for (let y = x + 1; y < occurrences.length; y++) {
        const a = occurrences[x]
        const b = occurrences[y]
        if (a.file === b.file && Math.abs(a.index - b.index) < window) continue
        const key = `${a.file}\0${b.file}`
        const list = pairsByFiles.get(key) ?? []
        list.push([a, b])
        pairsByFiles.set(key, list)
      }
    }
  }

  const blocks: DuplicateBlock[] = []
  for (const pairs of pairsByFiles.values()) {
    pairs.sort((p, q) => p[0].index - q[0].index || p[1].index - q[1].index)
    let run: Run | null = null
    for (const [a, b] of pairs) {
      if (
        run !== null &&
        a.index === run.a.index + run.length - window + 1 &&
        b.index === run.b.index + run.length - window + 1
      ) {
        run.length++
      } else {
        if (run !== null) blocks.push({ a: location(run.a, run.length), b: location(run.b, run.length), lines: run.length })
        run = { a, b, length: window }
      }
    }
    if (run !== null) blocks.push({ a: location(run.a, run.length), b: location(run.b, run.length), lines: run.length })
  }

  return blocks.sort((x, y) => compareLocations(x.a, y.a) || compareLocations(x.b, y.b))
}
