import * as fs from 'node:fs'
import * as path from 'node:path'
import { collectSourceFiles } from '../sourceScan'

describe('secrets hygiene', () => {
  test('no Mapbox-style access-token literal appears in source', () => {
    const tokenLiteral = /\b[ps]k\.[A-Za-z0-9]/
    const offenders = collectSourceFiles()
      .filter((f) => tokenLiteral.test(f.content))
      .map((f) => f.path)
    expect(offenders).toEqual([])
  })

  test('.env is gitignored so secrets never get committed', () => {
    const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf8')
    const patterns = gitignore.split('\n').map((line) => line.trim())
    expect(patterns).toContain('.env')
  })
})
