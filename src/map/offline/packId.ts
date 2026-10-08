const PREFIX = 'offline'

export function packId(trailId: number, styleId: string): string {
  return `${PREFIX}:${trailId}:${styleId}`
}

export function parsePackId(id: string): { trailId: number; styleId: string } | null {
  const parts = id.split(':')
  if (parts.length < 3 || parts[0] !== PREFIX) return null
  const trailId = Number(parts[1])
  if (!Number.isInteger(trailId)) return null
  const styleId = parts.slice(2).join(':')
  if (styleId.length === 0) return null
  return { trailId, styleId }
}

export function packsForTrail<T extends { id: string }>(
  items: T[],
  trailId: number,
): { pack: T; styleId: string }[] {
  const matches: { pack: T; styleId: string }[] = []
  for (const item of items) {
    const parsed = parsePackId(item.id)
    if (parsed?.trailId === trailId) matches.push({ pack: item, styleId: parsed.styleId })
  }
  return matches
}
