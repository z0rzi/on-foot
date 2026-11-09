import { activityActionItems } from '../activityActions'

describe('activityActionItems', () => {
  test('one red Delete activity item', () => {
    const items = activityActionItems({ remove: () => {} })
    expect(items.map(({ label, danger }) => ({ label, danger }))).toEqual([{ label: 'Delete activity', danger: true }])
  })

  test('the delete item calls remove', () => {
    const remove = jest.fn()
    activityActionItems({ remove })[0].onPress()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
