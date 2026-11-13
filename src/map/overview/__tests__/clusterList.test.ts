import { clusterListRows } from '../clusterList'

const trail = (id: number) => ({ id, name: `Trail ${id}` })
const activity = (id: number, linkedTrailId: number | null) => ({ id, name: `Walk ${id}`, linkedTrailId, startedAt: id })

const trails = [trail(1), trail(2)]
const activities = [activity(10, 2), activity(11, 2), activity(12, null)]

describe('the cluster list’s rows (D118)', () => {
  it('keeps the listed order, each trail with its completed count', () =>
    expect(
      clusterListRows([{ kind: 'trail', id: 2 }, { kind: 'trail', id: 1 }, { kind: 'activity', id: 12 }], trails, activities),
    ).toEqual([
      { kind: 'trail', trail: trail(2), completed: 2 },
      { kind: 'trail', trail: trail(1), completed: 0 },
      { kind: 'activity', activity: activity(12, null) },
    ]))

  it('drops an item deleted while the list is open', () =>
    expect(clusterListRows([{ kind: 'trail', id: 3 }, { kind: 'activity', id: 11 }], trails, activities)).toEqual([
      { kind: 'activity', activity: activity(11, 2) },
    ]))
})
