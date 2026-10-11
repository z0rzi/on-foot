import { GpxReadError } from '../data/trails/gpx/readFile'
import { GpxError } from '../data/trails/gpx/parse'

// An unrecognised failure keeps the 'format' wording, so it degrades to the pre-existing
// behaviour rather than to no message at all.
export function gpxImportAlert(err: unknown): { title: string; message: string } {
  if (err instanceof GpxReadError) {
    return {
      title: 'Could not open the file',
      message: 'The file could not be read. It may have moved, or this app may not have permission to open it.',
    }
  }
  if (err instanceof GpxError && err.reason === 'empty') {
    return { title: 'No route found', message: 'This GPX file has no route or track points to import.' }
  }
  return { title: 'Not a GPX file', message: 'This file could not be read as GPX.' }
}
