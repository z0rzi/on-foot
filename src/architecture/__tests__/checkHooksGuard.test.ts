import { findUnguardedCheckHooks } from '../checkHooksGuard'
import { collectSourceFiles } from '../sourceScan'

const GUARDED = `const CheckHookDispatcher =
  process.env.EXPO_PUBLIC_DEBUG_CHECK_HOOKS === '1'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- why
      (require('../src/checkHooks/CheckHookDispatcher') as typeof import('../src/checkHooks/CheckHookDispatcher')).CheckHookDispatcher
    : null`

const layout = (content: string) => [{ path: 'app/_layout.tsx', content }]

describe('the check hooks stay behind the flag', () => {
  it('holds in the tree', () => {
    expect(findUnguardedCheckHooks(collectSourceFiles())).toEqual([])
  })

  it('allows the require in a branch on the literal flag', () => {
    expect(findUnguardedCheckHooks(layout(GUARDED))).toEqual([])
  })

  it('flags a top-level import of hook code', () => {
    expect(findUnguardedCheckHooks(layout(`import { HOOKS } from '../src/checkHooks/hooks'`))).toEqual(['app/_layout.tsx'])
  })

  it('flags a require on another condition', () => {
    const content = GUARDED.replace("process.env.EXPO_PUBLIC_DEBUG_CHECK_HOOKS === '1'", '__DEV__')
    expect(findUnguardedCheckHooks(layout(content))).toEqual(['app/_layout.tsx'])
  })

  it('flags a second reference beside the guarded one', () => {
    expect(findUnguardedCheckHooks(layout(`${GUARDED}\nimport { replyText } from '../src/checkHooks/reply'`))).toEqual(['app/_layout.tsx'])
  })

  it('flags the native module bound outside the dispatcher', () => {
    const files = [{ path: 'src/trails/x.ts', content: "import { hookFolder } from '../../modules/check-hooks'" }]
    expect(findUnguardedCheckHooks(files)).toEqual(['src/trails/x.ts'])
  })

  it('lets the dispatcher import its own files and the native module', () => {
    const files = [{ path: 'src/checkHooks/CheckHookDispatcher.tsx', content: "import { addCheckHookListener } from '../../modules/check-hooks'\nimport { HOOKS } from './hooks'" }]
    expect(findUnguardedCheckHooks(files)).toEqual([])
  })
})
