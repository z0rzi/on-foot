import { hasEnoughDiskSpace } from '../diskSpace'
import { DISK_SPACE_RESERVE_BYTES } from '../constants'

describe('hasEnoughDiskSpace', () => {
  const est = 50_000_000

  test('true when free space exactly equals estimate plus the reserve', () => {
    expect(hasEnoughDiskSpace(est + DISK_SPACE_RESERVE_BYTES, est)).toBe(true)
  })

  test('false when free space is one byte short of estimate plus reserve', () => {
    expect(hasEnoughDiskSpace(est + DISK_SPACE_RESERVE_BYTES - 1, est)).toBe(false)
  })

  test('a zero-byte estimate still requires the reserve to be free', () => {
    expect(hasEnoughDiskSpace(DISK_SPACE_RESERVE_BYTES, 0)).toBe(true)
    expect(hasEnoughDiskSpace(DISK_SPACE_RESERVE_BYTES - 1, 0)).toBe(false)
  })

  test('false when a large estimate exceeds free space', () => {
    expect(hasEnoughDiskSpace(1_000_000_000, 5_000_000_000)).toBe(false)
  })
})
