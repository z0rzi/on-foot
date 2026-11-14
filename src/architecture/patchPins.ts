// A patch-package patch is named for the exact version it was cut against, so the package it
// patches is declared at that version: a range lets an install move the package under its patch.
export interface UnpinnedPatch {
  patch: string
  name: string | null
  version: string | null
  declared: string | null
}

const PATCH_FILE = /\.patch$/
const PATCH_NAME = /^((?:@[^+]+\+)?[^+]+)\+([^+]+)\.patch$/

export function findUnpinnedPatches(patchFiles: string[], declared: Record<string, string>): UnpinnedPatch[] {
  const unpinned: UnpinnedPatch[] = []
  for (const patch of patchFiles.filter((f) => PATCH_FILE.test(f))) {
    const match = PATCH_NAME.exec(patch)
    if (!match) {
      unpinned.push({ patch, name: null, version: null, declared: null })
      continue
    }
    const name = match[1].replace('+', '/')
    const version = match[2]
    const range = declared[name] ?? null
    if (range !== version) unpinned.push({ patch, name, version, declared: range })
  }
  return unpinned
}
