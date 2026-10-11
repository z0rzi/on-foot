import { GpxReadError } from '../data/trails/gpx/readFile'
import { GpxError } from '../data/trails/gpx/parse'

export type GpxImportFailure = 'read' | 'empty' | 'format'

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
}

export function gpxImportAlert(failure: GpxImportFailure): { title: string; message: string } {
  return ALERTS[failure]
}
