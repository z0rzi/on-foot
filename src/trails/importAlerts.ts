import { GpxReadError } from '../data/trails/gpx/readFile'
import { GpxError } from '../data/trails/gpx/parse'

// 'metrics' is never classified from an error: the route parsed, and the failure came after.
export type GpxImportFailure = 'read' | 'empty' | 'format' | 'metrics'

// An unrecognised failure falls back to 'format', so it degrades to the pre-existing behaviour
// rather than to no classification at all.
export function classifyGpxFailure(err: unknown): GpxImportFailure {
  if (err instanceof GpxReadError) return 'read'
  if (err instanceof GpxError && err.reason === 'empty') return 'empty'
  return 'format'
}

const ALERTS: Record<GpxImportFailure, { title: string; message: string }> = {
  read: {
    title: 'Could not open the file',
    message: 'The file could not be read. It may have moved, or this app may not have permission to open it.',
  },
  empty: { title: 'No route found', message: 'This GPX file has no route or track points to import.' },
  format: { title: 'Not a GPX file', message: 'This file could not be read as GPX.' },
  metrics: {
    title: 'Could not measure the route',
    message: 'The route was read, but its distance and elevation could not be computed.',
  },
}

export function gpxImportAlert(failure: GpxImportFailure): { title: string; message: string } {
  return ALERTS[failure]
}
