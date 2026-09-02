import { Paths } from 'expo-file-system'
import { DISK_SPACE_RESERVE_BYTES } from './constants'

export function requiredDiskSpace(estimatedBytes: number): number {
  return estimatedBytes + DISK_SPACE_RESERVE_BYTES
}

export function hasEnoughDiskSpace(freeBytes: number, estimatedBytes: number): boolean {
  return freeBytes >= requiredDiskSpace(estimatedBytes)
}

export function readFreeDiskBytes(): number {
  return Paths.availableDiskSpace
}
