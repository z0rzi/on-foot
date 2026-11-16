import { GpxReadError, readGpxFile } from '../data/trails/gpx/readFile'
import { GpxParseResult, parseGpx } from '../data/trails/gpx/parse'
import { metricsForSegments } from '../data/geo/metrics'
import type { Difficulty, TrailGeometry, TrailMetrics } from '../data/trails/types'
import { useTrailsStore } from '../store/trailsStore'
import { errorClass, logEvent } from '../log'
import { classifyGpxFailure, GpxImportFailure } from './importAlerts'

export interface TrailFile {
  name: string
  metrics: TrailMetrics
  geometry: TrailGeometry
}

type TrailFileReading = { ok: true; file: TrailFile } | { ok: false; failure: GpxImportFailure }

const IMPORT_FAILURE_LOG_PHRASE: Record<GpxImportFailure, string> = {
  read: 'file could not be read',
  empty: 'no route in the file',
  format: 'not recognised as GPX',
  metrics: 'metrics could not be computed',
}

function refuse(failure: GpxImportFailure, err: unknown): TrailFileReading {
  // The phrase already names a read failure, so the log takes the class of its cause.
  logEvent('error', 'error', `gpx import failed, ${IMPORT_FAILURE_LOG_PHRASE[failure]}`, {
    errorClass: errorClass(err instanceof GpxReadError ? err.cause : err),
  })
  return { ok: false, failure }
}

// Reads, parses and measures a GPX file; the name is its title, else the file's name.
export async function readTrailFile(uri: string, fileName: string | null): Promise<TrailFileReading> {
  let parsed: GpxParseResult
  try {
    parsed = parseGpx(await readGpxFile(uri), fileName)
  } catch (err) {
    return refuse(classifyGpxFailure(err), err)
  }
  let metrics: TrailMetrics
  try {
    metrics = metricsForSegments(parsed.segments)
  } catch (err) {
    return refuse('metrics', err)
  }
  return {
    ok: true,
    file: {
      name: parsed.title ?? fileName ?? '',
      metrics,
      geometry: { segments: parsed.segments, waypoints: parsed.waypoints },
    },
  }
}

interface TrailImport {
  uri: string
  name: string
  difficulty: Difficulty
}

// Imports a GPX file in one step, under the name the request gives rather than the file's own.
export async function importTrail({ uri, name, difficulty }: TrailImport): Promise<{ ok: true; id: number } | { ok: false; failure: GpxImportFailure }> {
  const reading = await readTrailFile(uri, null)
  if (!reading.ok) return reading
  const { metrics, geometry } = reading.file
  const id = await useTrailsStore.getState().addTrail({ name, difficulty, description: null, metrics, geometry })
  return { ok: true, id }
}
