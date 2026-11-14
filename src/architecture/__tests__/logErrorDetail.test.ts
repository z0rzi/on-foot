import { LOG_MESSAGE_EXEMPT, findErrorMessageInLog } from '../logErrorDetail'
import { collectSourceFiles } from '../sourceScan'

const file = (content: string, path = 'src/x.ts') => [{ path, content }]

describe('error detail in the debug log', () => {
  const sources = collectSourceFiles()

  test('every logged error outside the exemptions is logged by its class', () => {
    const report = findErrorMessageInLog(sources)
      .map((f) => `  ${f.file}:${f.line} logs ${f.expression} -> log errorClass(error) instead`)
      .join('\n')
    expect(report === '' ? '' : `\nError messages in the debug log:\n${report}\n`).toBe('')
  })

  test('every exemption still covers a message the log takes', () => {
    const covering = new Set(findErrorMessageInLog(sources, []).map((f) => f.file))
    expect(LOG_MESSAGE_EXEMPT.map((e) => e.file).filter((f) => !covering.has(f))).toEqual([])
  })

  test('flags an error turned into its message by String()', () => {
    const files = file("logEvent('error', 'error', 'saving failed', { error: String(error) })")
    expect(findErrorMessageInLog(files, [])).toEqual([{ file: 'src/x.ts', line: 1, expression: 'String(error)' }])
  })

  test('flags a message or a stack read off the error, on the line it sits', () => {
    const files = file(
      [
        "logEvent('error', 'error', 'render failed', {",
        '  message: error.message,',
        '  stack: error.stack,',
        '})',
      ].join('\n'),
    )
    expect(findErrorMessageInLog(files)).toEqual([
      { file: 'src/x.ts', line: 2, expression: 'error.message' },
      { file: 'src/x.ts', line: 3, expression: 'error.stack' },
    ])
  })

  test('allows the class of the error', () => {
    const files = file("logEvent('warn', 'map', 'press failed', { errorClass: errorClass(error) })")
    expect(findErrorMessageInLog(files)).toEqual([])
  })

  test('reads only the detail, not the phrase of the entry', () => {
    const files = file('for (const entry of entries) logEvent(entry.level, entry.area, entry.message, entry.detail)')
    expect(findErrorMessageInLog(files)).toEqual([])
  })

  test('finds the detail past a comma inside a template literal phrase', () => {
    const files = file("logEvent('error', 'error', `gpx import failed, ${phrase[failure]}`, { error: String(err.cause) })")
    expect(findErrorMessageInLog(files).map((f) => f.expression)).toEqual(['String(err.cause)'])
  })

  test('ignores String() outside a logEvent call', () => {
    const files = file("const key = String(entry.id)\nlogEvent('info', 'map', 'listed', { key })")
    expect(findErrorMessageInLog(files)).toEqual([])
  })

  test('reads past an apostrophe or a comma in a comment inside the call', () => {
    const files = file(
      [
        "logEvent('error', 'error', 'saving failed', // can't save, so say why",
        '  { error: String(error) })',
      ].join('\n'),
    )
    expect(findErrorMessageInLog(files).map((f) => f.line)).toEqual([2])
  })

  test('ignores a call that is commented out', () => {
    const files = file("// logEvent('error', 'error', 'saving failed', { error: String(error) })\n/* logEvent(a, b, c, { e: e.message }) */")
    expect(findErrorMessageInLog(files)).toEqual([])
  })

  test('passes a message in an exempt file', () => {
    const files = file("logEvent('error', 'error', 'render failed', { message: error.message })", 'src/Boundary.tsx')
    expect(findErrorMessageInLog(files, [{ file: 'src/Boundary.tsx', rationale: 'test' }])).toEqual([])
  })

  test("ignores logEvent's own declaration", () => {
    const files = file('export function logEvent(level: LogLevel, area: LogArea, message: string, detail?: unknown): void {}')
    expect(findErrorMessageInLog(files)).toEqual([])
  })
})
