import * as fs from 'node:fs'
import { findUnpinnedPatches } from '../patchPins'
import { readRepoJson } from '../repoFiles'

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('patched packages are pinned', () => {
  test('package.json declares every patched package at the version its patch names', () => {
    const pkg = readRepoJson<PackageJson>('package.json')
    const declared = { ...pkg.dependencies, ...pkg.devDependencies }
    const report = findUnpinnedPatches(fs.readdirSync('patches'), declared)
      .map((u) =>
        u.name === null
          ? `  ${u.patch}: not a name+version.patch file -> name the patch for one package and its version`
          : `  ${u.patch}: declared ${u.declared ?? 'nowhere'} -> declare "${u.name}": "${u.version}"`,
      )
      .join('\n')
    expect(report === '' ? '' : `\nPatched packages not pinned:\n${report}\n`).toBe('')
  })

  test('flags a patched package declared with a range', () => {
    expect(findUnpinnedPatches(['expo-location+57.0.11.patch'], { 'expo-location': '~57.0.11' })).toEqual([
      { patch: 'expo-location+57.0.11.patch', name: 'expo-location', version: '57.0.11', declared: '~57.0.11' },
    ])
  })

  test('reads a scoped package name out of its patch file', () => {
    const patch = '@gorhom+bottom-sheet+5.2.14.patch'
    expect(findUnpinnedPatches([patch], { '@gorhom/bottom-sheet': '5.2.14' })).toEqual([])
    expect(findUnpinnedPatches([patch], { '@gorhom/bottom-sheet': '5.2.13' })).toEqual([
      { patch, name: '@gorhom/bottom-sheet', version: '5.2.14', declared: '5.2.13' },
    ])
  })

  test('flags a patched package package.json does not declare', () => {
    expect(findUnpinnedPatches(['left-pad+1.3.0.patch'], {})).toEqual([
      { patch: 'left-pad+1.3.0.patch', name: 'left-pad', version: '1.3.0', declared: null },
    ])
  })

  test('flags a patch file whose name it cannot read, rather than passing it', () => {
    expect(findUnpinnedPatches(['parent++child+1.0.0.patch'], {})).toEqual([
      { patch: 'parent++child+1.0.0.patch', name: null, version: null, declared: null },
    ])
  })

  test('ignores files that are not patches', () => {
    expect(findUnpinnedPatches(['README.md', '.gitkeep'], {})).toEqual([])
  })
})
