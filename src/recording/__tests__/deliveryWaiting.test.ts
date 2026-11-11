import { deliveryWaiting } from '../deliveryWaiting'

const NOW = 1_000_000

test('nothing pending: the delivery waits behind nothing', () => {
  expect(deliveryWaiting([], NOW, null)).toBeNull()
})

test('one pending for under 10 s is a normal overlap', () => {
  expect(deliveryWaiting([NOW - 9_999], NOW, null)).toBeNull()
  expect(deliveryWaiting([NOW - 10_000], NOW, null)).toBeNull()
})

test('one pending for over 10 s: the arriving delivery waits behind it', () => {
  expect(deliveryWaiting([NOW - 10_001], NOW, null)).toEqual({ waiting: 1, oldestS: 10 })
})

test('counts every delivery held behind the oldest, the arriving one included', () => {
  expect(deliveryWaiting([NOW - 47_300, NOW - 43_000, NOW - 4_000], NOW, null)).toEqual({ waiting: 3, oldestS: 47 })
})

test('says it at most once per 30 s', () => {
  const pending = [NOW - 60_000]
  expect(deliveryWaiting(pending, NOW, NOW - 29_999)).toBeNull()
  expect(deliveryWaiting(pending, NOW, NOW - 30_000)).toEqual({ waiting: 1, oldestS: 60 })
})
