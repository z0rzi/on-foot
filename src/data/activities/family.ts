import type { ActivitySummary } from './types'

type FamilyMember = Pick<ActivitySummary, 'linkedTrailId' | 'startedAt'>

// Each trail's family activities, most recent first: its card's list, and its completed count
// (a trail is completed when its family holds at least one activity).
export function familiesByTrail<A extends FamilyMember>(activities: readonly A[]): Map<number, A[]> {
  const families = new Map<number, A[]>()
  for (const a of activities) {
    if (a.linkedTrailId == null) continue
    const family = families.get(a.linkedTrailId)
    if (family) family.push(a)
    else families.set(a.linkedTrailId, [a])
  }
  for (const family of families.values()) family.sort((x, y) => y.startedAt - x.startedAt)
  return families
}
