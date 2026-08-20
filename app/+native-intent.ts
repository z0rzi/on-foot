export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('content://') || path.startsWith('file://')) {
    return `/trail/new?uri=${encodeURIComponent(path)}`
  }
  return path
}
