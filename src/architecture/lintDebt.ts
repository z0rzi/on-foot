import { SourceFile } from './sourceScan'

// Every standing eslint-disable is explained in docs/architecture/lint-debt.md. The doc explains
// rules in prose, so a file is inventoried when its path, in backticks, appears in the standing
// exceptions section.
export const LINT_DEBT_DOC = 'docs/architecture/lint-debt.md'

const INVENTORY_HEADING = /^## Standing inline exceptions\b.*$/m
const DIRECTIVE = /(?:\/\/|\/\*)\s*eslint-disable\b/

function inventorySection(doc: string): string {
  const heading = INVENTORY_HEADING.exec(doc)
  if (!heading) return ''
  const start = heading.index
  const next = doc.indexOf('\n## ', start)
  return doc.slice(start, next === -1 ? doc.length : next)
}

export function findUninventoriedDisables(files: SourceFile[], doc: string): string[] {
  const inventory = inventorySection(doc)
  return files.filter((f) => DIRECTIVE.test(f.content) && !inventory.includes(`\`${f.path}\``)).map((f) => f.path)
}
