import { Paths } from 'expo-file-system'
import { DISK_SPACE_RESERVE_BYTES } from './constants'

export function hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean {
  return freeBytes >= estimatedBytes + DISK_SPACE_RESERVE_BYTES
}

export function readFreeDiskBytes(): number {
  return Paths.availableDiskSpace
}
