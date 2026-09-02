import { Paths } from 'expo-file-system'
import { DISK_SPACE_RESERVE_BYTES } from './constants'

export function requiredDiskSpace(estimatedBytes: number): number {
  return estimatedBytes + DISK_SPACE_RESERVE_BYTES
}

export function hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean {
  return freeBytes >= requiredDiskSpace(estimatedBytes)
}

export function readFreeDiskBytes(): number | null {
  // iOS reports nil (surfaced as a non-finite value) when the filesystem attributes
  // can't be read; normalise that to null so the caller fails open rather than blocking
  // a download with a garbage size.
  const free = Paths.availableDiskSpace
  return Number.isFinite(free) ? free : null
}
