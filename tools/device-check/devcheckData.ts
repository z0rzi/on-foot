// What the toolkit creates is named with this prefix, and only what carries it is edited or
// deleted: every other trail and activity on the phone is the owner's.
export const DEVCHECK_PREFIX = 'DEVCHECK '

export const isDevcheckName = (name: string) => name.startsWith(DEVCHECK_PREFIX) && name.length > DEVCHECK_PREFIX.length

export function devcheckName(name: string): string {
  return name.startsWith(DEVCHECK_PREFIX) ? name : `${DEVCHECK_PREFIX}${name}`
}

export function requireDevcheckName(name: string): void {
  if (!isDevcheckName(name)) throw new Error(`refused: "${name}" does not start with "${DEVCHECK_PREFIX}"; only DEVCHECK items are deleted`)
}

export const devcheckNames = (names: string[]) => names.filter(isDevcheckName)
