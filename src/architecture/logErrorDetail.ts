import { SourceFile } from './sourceScan'

// The debug log holds an error by its class, never its message (docs/architecture/debug-log.md,
// "Errors in the log"). This reads the detail argument of every logEvent call for the two shapes a
// message takes on its way in: String(…) and a .message or .stack read.
export interface ErrorMessageInLog {
  file: string
  line: number
  expression: string
}

export interface LogMessageExemption {
  file: string
  rationale: string
}

export const LOG_MESSAGE_EXEMPT: LogMessageExemption[] = [
  {
    file: 'src/components/ErrorBoundary.tsx',
    rationale:
      'A render error is a bug nobody anticipated: its message and stack are the only trace of it, and no failure the user is told about lands here.',
  },
  {
    file: 'src/map/useHeadingLog.ts',
    rationale:
      "The heading watch's rejection is written by the native heading module: it describes the failure, carries no payload, and its class alone would say nothing.",
  },
]

interface Span {
  start: number
  end: number
}

interface MessageShape {
  index: number
  expression: string
}

const CALL = /(?<!function\s)\blogEvent\(/g
const DETAIL_ARGUMENT_INDEX = 3
const MESSAGE_SHAPE = /\bString\(|[\w$\])?]\.(?:message|stack)\b/g
const isQuote = (c: string) => c === "'" || c === '"' || c === '`'

function skipString(text: string, at: number): number {
  const quote = text[at]
  let i = at + 1
  while (i < text.length && text[i] !== quote) {
    if (text[i] === '\\') i += 1
    else if (quote === '`' && text[i] === '$' && text[i + 1] === '{') i = closingBracket(text, i + 1)
    i += 1
  }
  return i
}

// Comments become spaces, newlines kept, so every index and line of the text still holds.
function blankComments(text: string): string {
  const out = text.split('')
  for (let i = 0; i < text.length; i += 1) {
    if (isQuote(text[i])) i = skipString(text, i)
    else if (text.startsWith('//', i) || text.startsWith('/*', i)) {
      const close = text.startsWith('//', i) ? text.indexOf('\n', i) : text.indexOf('*/', i) + 2
      const end = close < i ? text.length : close
      for (let j = i; j < end; j += 1) if (out[j] !== '\n') out[j] = ' '
      i = end - 1
    }
  }
  return out.join('')
}

// The index of the bracket that closes the one at `open`, strings skipped.
function closingBracket(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const c = text[i]
    if (isQuote(c)) i = skipString(text, i)
    else if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return text.length
}

function callArguments(text: string, open: number): Span[] {
  const args: Span[] = []
  const end = closingBracket(text, open)
  let start = open + 1
  for (let i = open + 1; i < end; i += 1) {
    const c = text[i]
    if (isQuote(c)) i = skipString(text, i)
    else if (c === '(' || c === '{' || c === '[') i = closingBracket(text, i)
    else if (c === ',') {
      args.push({ start, end: i })
      start = i + 1
    }
  }
  if (text.slice(start, end).trim() !== '') args.push({ start, end })
  return args
}

const lineAt = (text: string, index: number) => text.slice(0, index).split('\n').length

function messageShapes(text: string, span: Span): MessageShape[] {
  const found: MessageShape[] = []
  for (const match of text.slice(span.start, span.end).matchAll(MESSAGE_SHAPE)) {
    const index = span.start + match.index
    if (match[0] === 'String(') {
      const open = index + 'String'.length
      found.push({ index, expression: text.slice(index, closingBracket(text, open) + 1) })
    } else {
      const property = index + 1
      const owner = /[\w$.?]*$/.exec(text.slice(span.start, property))?.[0] ?? ''
      found.push({ index: property - owner.length, expression: `${owner}${match[0].slice(1)}` })
    }
  }
  return found
}

export function findErrorMessageInLog(
  files: SourceFile[],
  exempt: LogMessageExemption[] = LOG_MESSAGE_EXEMPT,
): ErrorMessageInLog[] {
  const exemptFiles = new Set(exempt.map((e) => e.file))
  const found: ErrorMessageInLog[] = []
  for (const file of files) {
    if (exemptFiles.has(file.path)) continue
    const text = blankComments(file.content)
    for (const call of text.matchAll(CALL)) {
      const open = call.index + call[0].length - 1
      for (const span of callArguments(text, open).slice(DETAIL_ARGUMENT_INDEX)) {
        for (const shape of messageShapes(text, span)) {
          found.push({ file: file.path, line: lineAt(text, shape.index), expression: shape.expression })
        }
      }
    }
  }
  return found
}
