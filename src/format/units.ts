export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`
}

export function formatElevation(meters: number | null): string {
  return meters === null ? '—' : `${meters.toFixed(0)} m`
}

export const twoDigits = (n: number): string => n.toString().padStart(2, '0')

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours} h ${twoDigits(minutes)}`
  if (minutes > 0) return seconds > 0 ? `${minutes} min ${twoDigits(seconds)} s` : `${minutes} min`
  return `${seconds} s`
}
