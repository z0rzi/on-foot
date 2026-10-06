import { newTrailHref } from '../src/trails/newTrailHref'

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('content://') || path.startsWith('file://')) {
    return newTrailHref(path)
  }
  return path
}
