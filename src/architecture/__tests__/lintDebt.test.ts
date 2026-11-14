import { LINT_DEBT_DOC, findUninventoriedDisables } from '../lintDebt'
import { readRepoText } from '../repoFiles'
import { APP_AND_TOOLING_ROOTS, collectSourceFiles } from '../sourceScan'

const doc = (inventory: string) =>
  ['# Lint policy', '', '## Standing inline exceptions', '', inventory, '', '## Scoped relaxations', ''].join('\n')

describe('lint-debt inventory', () => {
  test('every file holding an eslint-disable is named in the standing exceptions', () => {
    const missing = findUninventoriedDisables(collectSourceFiles(APP_AND_TOOLING_ROOTS), readRepoText(LINT_DEBT_DOC))
    const report = missing.map((f) => `  ${f} -> add it to "Standing inline exceptions" in ${LINT_DEBT_DOC}`).join('\n')
    expect(report === '' ? '' : `\nDisables missing from the inventory:\n${report}\n`).toBe('')
  })

  test('flags a file whose disable the inventory does not name', () => {
    const files = [
      { path: 'src/a.ts', content: '// eslint-disable-next-line react-hooks/refs -- why\nconst a = ref.current' },
      { path: 'src/b.tsx', content: '/* eslint-disable react-hooks/refs -- why */\nconst b = 1' },
    ]
    expect(findUninventoriedDisables(files, doc('- **`react-hooks/refs`** in `src/a.ts`'))).toEqual(['src/b.tsx'])
  })

  test('a path is matched whole, so a sibling with a longer name is not inventoried', () => {
    const files = [{ path: 'src/a.ts', content: '// eslint-disable-line no-console -- why' }]
    expect(findUninventoriedDisables(files, doc('- **`no-console`** in `src/a.tsx`'))).toEqual(['src/a.ts'])
  })

  test('a file named outside the standing exceptions section is not inventoried', () => {
    const files = [{ path: 'src/a.ts', content: '// eslint-disable-line no-console -- why' }]
    const text = `Fixed in \`src/a.ts\`.\n${doc('- nothing standing')}`
    expect(findUninventoriedDisables(files, text)).toEqual(['src/a.ts'])
  })

  test('every disabling file is uninventoried when the section is gone', () => {
    const files = [{ path: 'src/a.ts', content: '// eslint-disable-next-line no-console -- why' }]
    expect(findUninventoriedDisables(files, '# Lint policy\n\n`src/a.ts`\n')).toEqual(['src/a.ts'])
  })

  test('ignores a file that only mentions the directive outside a comment', () => {
    const files = [{ path: 'src/a.ts', content: "const hint = 'add eslint-disable-next-line to silence it'" }]
    expect(findUninventoriedDisables(files, doc(''))).toEqual([])
  })

  test('ignores a re-enable', () => {
    const files = [{ path: 'src/a.ts', content: '/* eslint-enable react-hooks/refs */' }]
    expect(findUninventoriedDisables(files, doc(''))).toEqual([])
  })
})
