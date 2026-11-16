import { SourceFile } from './sourceScan'

// The check hooks' code reaches a bundle only through one require, in a branch whose test is the
// literal flag the bundler inlines: with the flag unset the branch, the require and everything under
// src/checkHooks/ are dropped. Any other reference, an import above all, puts them in every build.
const INSIDE = ['src/checkHooks/', 'modules/check-hooks/']

const REFERENCE = /(?:from|import|require\()\s*\(?\s*['"][^'"]*(?:checkHooks|check-hooks)(?:\/[^'"]*)?['"]/

const GUARDED_REQUIRE =
  /process\.env\.EXPO_PUBLIC_DEBUG_CHECK_HOOKS === '1'\s*\?\s*(?:\/\/[^\n]*\n\s*)?\(require\('([^']*\/checkHooks\/CheckHookDispatcher)'\) as typeof import\('\1'\)\)/g

export function findUnguardedCheckHooks(files: SourceFile[]): string[] {
  return files
    .filter((file) => !INSIDE.some((dir) => file.path.startsWith(dir)))
    .filter((file) => REFERENCE.test(file.content.replace(GUARDED_REQUIRE, '')))
    .map((file) => file.path)
}
