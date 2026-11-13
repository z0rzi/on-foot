import { familiesByTrail } from '../family'

const activity = (id: number, linkedTrailId: number | null, startedAt: number) => ({ id, linkedTrailId, startedAt })

describe('familiesByTrail', () => {
  it("gives a trail its linked activities, most recent first, whatever the rows' order", () => {
    const families = familiesByTrail([activity(1, 7, 100), activity(2, 7, 300), activity(3, 7, 200)])
    expect(families.get(7)?.map((a) => a.id)).toEqual([2, 3, 1])
  })

  it("keeps each trail's activities in its own family", () => {
    const families = familiesByTrail([activity(1, 7, 100), activity(2, 8, 300), activity(3, 7, 200)])
    expect(families.get(7)?.map((a) => a.id)).toEqual([3, 1])
    expect(families.get(8)?.map((a) => a.id)).toEqual([2])
  })

  it('puts an activity linked to no trail in no family', () => {
    const families = familiesByTrail([activity(1, null, 100), activity(2, 7, 200)])
    expect([...families.keys()]).toEqual([7])
    expect(families.get(7)?.map((a) => a.id)).toEqual([2])
  })

  it('has no family for a trail no activity is linked to, so it is not completed', () => {
    expect(familiesByTrail([activity(1, 7, 100)]).has(8)).toBe(false)
    expect(familiesByTrail([]).size).toBe(0)
  })

  it('hands back the rows it was given, extra fields included', () => {
    const row = { ...activity(1, 7, 100), name: 'Morning loop' }
    expect(familiesByTrail([row]).get(7)?.[0]).toBe(row)
  })
})
