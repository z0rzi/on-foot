import eslintConfig from '../../../eslint.config.js'
import { findScopeGaps, readGateIgnores } from '../gateScopes'

const agreeing = {
  jest: ['/node_modules/', '/.claude/', '/.scratch/'],
  tsc: ['node_modules', '.claude/**', '.scratch/**'],
  eslint: ['dist/*', '.claude/**', '.scratch/**'],
}

describe('gate scopes agree on the agent directories', () => {
  test('jest, tsc and eslint all ignore every agent directory', () => {
    const report = findScopeGaps(readGateIgnores(eslintConfig))
      .map((g) => `  ${g.gate} does not ignore ${g.dir} -> add ${g.entry}`)
      .join('\n')
    expect(report === '' ? '' : `\nGate scopes disagree:\n${report}\n`).toBe('')
  })

  test('passes when every gate ignores every agent directory', () => {
    expect(findScopeGaps(agreeing, ['.claude', '.scratch'])).toEqual([])
  })

  test('flags the gate that lacks a directory, with the entry it needs', () => {
    const ignores = { ...agreeing, jest: ['/node_modules/', '/.claude/'] }
    expect(findScopeGaps(ignores, ['.claude', '.scratch'])).toEqual([
      { gate: 'jest', dir: '.scratch', entry: '/.scratch/' },
    ])
  })

  test('a narrower entry under the directory does not cover it', () => {
    const ignores = { ...agreeing, jest: ['/.claude/worktrees/', '/.scratch/'] }
    expect(findScopeGaps(ignores, ['.claude'])).toEqual([{ gate: 'jest', dir: '.claude', entry: '/.claude/' }])
  })
})
