import { resolveImport } from './importResolution'
import { moduleBindings } from './moduleBindings'
import { SourceFile } from './sourceScan'

// Every export needs an importer in another production file; the scan skips tests, so an export
// read only by its own file and its test is unused. Types count like values. `export default` is
// the name "default". A named re-export (`export { a } from`, `export * as ns from`) is an export
// of the barrel in its own right, and an import through it uses the origin; `export *` only
// forwards names, so a name nobody imports is reported once, at its origin. A namespace import,
// `require` or dynamic `import()` uses every export of its target. Under app/, the names
// expo-router reads by convention need no importer.
export interface UnusedExportExemption {
  path: string
  name?: string
  rationale: string
}

const PRE_EXISTING = 'pre-existing, triage'
const FIXTURE_TYPE = "an exported function's input, which its tests type their fixtures with"
const HOOK_CORE = 'the work behind the hook in the same file, tested directly as hooks are not'
const MAPPING_CORE = 'the summary mapping the full-row mappers in the same file build on, tested directly'

export const UNUSED_EXPORT_EXEMPT: UnusedExportExemption[] = [
  {
    path: 'src/architecture/',
    rationale: 'The architecture gates: their only consumers are the architecture tests in __tests__/, by design.',
  },
  { path: 'src/activities/activityActions.ts', name: 'ActivityActionHandlers', rationale: PRE_EXISTING },
  { path: 'src/activities/ActivityForm.tsx', name: 'ActivityFormValues', rationale: PRE_EXISTING },
  { path: 'src/activities/effort.ts', name: 'effortColor', rationale: PRE_EXISTING },
  { path: 'src/activities/effort.ts', name: 'effortLabel', rationale: PRE_EXISTING },
  { path: 'src/activities/effort.ts', name: 'EFFORTS', rationale: PRE_EXISTING },
  { path: 'src/components/loadedEntity.ts', name: 'LoadResult', rationale: PRE_EXISTING },
  { path: 'src/components/menuPlacement.ts', name: 'MenuPlacement', rationale: PRE_EXISTING },
  { path: 'src/components/menuPlacement.ts', name: 'MenuPlacementInput', rationale: PRE_EXISTING },
  { path: 'src/components/sheetBack.ts', name: 'SheetBackState', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'ActivityFormFields', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'ActivityInsertValues', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'ActivityRow', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'RecordingPointInsertValues', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'RecordingPointRow', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'RecordingSessionRow', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'serializeActivityGeometry', rationale: PRE_EXISTING },
  { path: 'src/data/activities/mapping.ts', name: 'rowToSummary', rationale: MAPPING_CORE },
  { path: 'src/data/geo/elevationFilter.ts', name: 'accumulateGainLoss', rationale: PRE_EXISTING },
  { path: 'src/data/geo/elevationFilter.ts', name: 'ELEVATION_DEADBAND_METERS', rationale: PRE_EXISTING },
  { path: 'src/data/geo/elevationFilter.ts', name: 'ELEVATION_SMOOTHING_WINDOW_METERS', rationale: PRE_EXISTING },
  { path: 'src/data/geo/elevationFilter.ts', name: 'ElevationChange', rationale: PRE_EXISTING },
  { path: 'src/data/geo/metrics.ts', name: 'computeMetrics', rationale: PRE_EXISTING },
  { path: 'src/data/geo/overview.ts', name: 'OverviewGeometry', rationale: 'the branded geometry type, which the derivations\' tests cast their fixtures to' },
  { path: 'src/data/trails/gpx/parse.ts', name: 'GpxFailure', rationale: PRE_EXISTING },
  { path: 'src/data/trails/mapping.ts', name: 'serializeGeometry', rationale: PRE_EXISTING },
  { path: 'src/data/trails/mapping.ts', name: 'TrailInsertValues', rationale: PRE_EXISTING },
  { path: 'src/data/trails/mapping.ts', name: 'TrailRow', rationale: PRE_EXISTING },
  { path: 'src/data/trails/mapping.ts', name: 'TrailUpdateValues', rationale: PRE_EXISTING },
  { path: 'src/data/trails/mapping.ts', name: 'rowToSummary', rationale: MAPPING_CORE },
  { path: 'src/elevation/axisLayout.ts', name: 'AxisLabel', rationale: PRE_EXISTING },
  { path: 'src/elevation/axisLayout.ts', name: 'AxisLayout', rationale: PRE_EXISTING },
  { path: 'src/elevation/bandGeometry.ts', name: 'BandSamples', rationale: PRE_EXISTING },
  { path: 'src/elevation/elevationAxis.ts', name: 'AxisTick', rationale: PRE_EXISTING },
  { path: 'src/elevation/graphLook.ts', name: 'FadeStop', rationale: PRE_EXISTING },
  { path: 'src/elevation/graphLook.ts', name: 'GraphLook', rationale: PRE_EXISTING },
  { path: 'src/elevation/mapSlope.ts', name: 'SlopeRun', rationale: PRE_EXISTING },
  { path: 'src/elevation/profile.ts', name: 'ScrubSample', rationale: PRE_EXISTING },
  { path: 'src/elevation/scrubStore.ts', name: 'ScrubPoint', rationale: PRE_EXISTING },
  { path: 'src/elevation/slope.ts', name: 'DisplayBanding', rationale: PRE_EXISTING },
  { path: 'src/elevation/slope.ts', name: 'slopeBands', rationale: PRE_EXISTING },
  { path: 'src/elevation/svg.ts', name: 'BandArea', rationale: PRE_EXISTING },
  { path: 'src/elevation/svg.ts', name: 'BandLine', rationale: PRE_EXISTING },
  { path: 'src/elevation/svg.ts', name: 'BandTop', rationale: PRE_EXISTING },
  { path: 'src/elevation/svg.ts', name: 'PlotScale', rationale: PRE_EXISTING },
  { path: 'src/elevation/trailProgress.ts', name: 'MATCH_RADIUS_METERS', rationale: PRE_EXISTING },
  { path: 'src/elevation/trailProgress.ts', name: 'NO_PROGRESS', rationale: PRE_EXISTING },
  { path: 'src/elevation/trailProgress.ts', name: 'replayAlongTrail', rationale: PRE_EXISTING },
  { path: 'src/elevation/trailProgress.ts', name: 'stepAlongTrail', rationale: PRE_EXISTING },
  { path: 'src/elevation/trailProgress.ts', name: 'TrailProgress', rationale: PRE_EXISTING },
  { path: 'src/external/index.ts', name: 'Destination', rationale: PRE_EXISTING },
  { path: 'src/location/expoLocation.ts', name: 'fixesFromTaskData', rationale: PRE_EXISTING },
  { path: 'src/location/expoLocation.ts', name: 'toLocationFix', rationale: PRE_EXISTING },
  { path: 'src/location/index.ts', name: 'NotificationAccess', rationale: PRE_EXISTING },
  { path: 'src/log/index.ts', name: 'LogArea', rationale: PRE_EXISTING },
  { path: 'src/log/index.ts', name: 'LogEntry', rationale: PRE_EXISTING },
  { path: 'src/log/logEvent.ts', name: 'flushLog', rationale: PRE_EXISTING },
  { path: 'src/log/logExportText.ts', name: 'LOG_EXPORT_MAX_CHARS', rationale: PRE_EXISTING },
  { path: 'src/log/logExportText.ts', name: 'LogExportMeta', rationale: PRE_EXISTING },
  { path: 'src/log/logExportText.ts', name: 'logLine', rationale: PRE_EXISTING },
  { path: 'src/log/retention.ts', name: 'LOG_RETENTION_DAYS', rationale: PRE_EXISTING },
  { path: 'src/map/geo.ts', name: 'toLineCoordinates', rationale: PRE_EXISTING },
  { path: 'src/map/offline/downloadBatches.ts', name: 'DownloadBatches', rationale: PRE_EXISTING },
  { path: 'src/map/offline/downloadDecision.ts', name: 'DownloadDecision', rationale: PRE_EXISTING },
  { path: 'src/map/offline/estimate.ts', name: 'latToTileY', rationale: PRE_EXISTING },
  { path: 'src/map/offline/estimate.ts', name: 'lngToTileX', rationale: PRE_EXISTING },
  { path: 'src/map/offline/estimate.ts', name: 'tileCountForBounds', rationale: PRE_EXISTING },
  { path: 'src/map/offline/menu.ts', name: 'OfflineMenuItem', rationale: PRE_EXISTING },
  { path: 'src/map/offline/plan.ts', name: 'OfflinePlan', rationale: PRE_EXISTING },
  { path: 'src/map/offline/plan.ts', name: 'PlanRow', rationale: PRE_EXISTING },
  { path: 'src/map/overview/pinList.ts', name: 'PinListInput', rationale: FIXTURE_TYPE },
  { path: 'src/map/overview/pressResolution.ts', name: 'PressInput', rationale: FIXTURE_TYPE },
  { path: 'src/map/pillContent.ts', name: 'PillInput', rationale: PRE_EXISTING },
  { path: 'src/map/provider/types.ts', name: 'MapComponents', rationale: PRE_EXISTING },
  { path: 'src/map/providers/mapbox/capabilities.ts', name: 'MAPBOX_STYLES', rationale: PRE_EXISTING },
  { path: 'src/map/providers/mapbox/offline.ts', name: 'mapPackState', rationale: PRE_EXISTING },
  { path: 'src/map/sheetRest.ts', name: 'SheetRestKind', rationale: PRE_EXISTING },
  { path: 'src/map/sheetSnapPoints.ts', name: 'SheetMeasure', rationale: PRE_EXISTING },
  { path: 'src/net/netinfo.ts', name: 'toConnectivityStatus', rationale: PRE_EXISTING },
  { path: 'src/recording/alongTrail.ts', name: 'TrailWhileRecording', rationale: PRE_EXISTING },
  { path: 'src/recording/captureAlerts.ts', name: 'CaptureAction', rationale: PRE_EXISTING },
  { path: 'src/recording/recordingController.ts', name: 'CaptureReadiness', rationale: PRE_EXISTING },
  { path: 'src/recording/recordingController.ts', name: 'ResumeResult', rationale: PRE_EXISTING },
  { path: 'src/recording/recordingController.ts', name: 'StartResult', rationale: PRE_EXISTING },
  { path: 'src/recording/recordingFigures.ts', name: 'RecordingFigure', rationale: PRE_EXISTING },
  { path: 'src/settings/preferencesStore.ts', name: 'nextPaceSpeedMode', rationale: PRE_EXISTING },
  { path: 'src/store/loadStoresAtLaunch.ts', name: 'loadStoresAtLaunch', rationale: HOOK_CORE },
  { path: 'src/store/mapStore.ts', name: 'demoteBearing', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'FollowCameraProps', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'followModeChange', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'FollowModeChange', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'nextFollowMode', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'normalizeDeg', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'PendingFit', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'pitchForFollowMode', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'resolveQuickSwitch', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'satelliteToggleTarget', rationale: PRE_EXISTING },
  { path: 'src/store/mapStore.ts', name: 'StyleChoice', rationale: PRE_EXISTING },
  { path: 'src/store/overviewBackfill.ts', name: 'backfillOverviews', rationale: HOOK_CORE },
  { path: 'src/theme/colors.ts', name: 'darkColors', rationale: PRE_EXISTING },
  { path: 'src/trails/difficulty.ts', name: 'DIFFICULTIES', rationale: PRE_EXISTING },
  { path: 'src/trails/difficulty.ts', name: 'difficultyColor', rationale: PRE_EXISTING },
  { path: 'src/trails/difficulty.ts', name: 'difficultyLabel', rationale: PRE_EXISTING },
  { path: 'src/trails/trailActions.ts', name: 'TrailActionHandlers', rationale: PRE_EXISTING },
  { path: 'src/trails/TrailForm.tsx', name: 'TrailFormValues', rationale: PRE_EXISTING },
]

export interface UnusedExport {
  file: string
  name: string
}

const ALL = '*'

// The exports expo-router reads from a route module by name (expo-router 57: getRoutesCore,
// fast-refresh, getLinkingConfig for +native-intent), so a file under app/ needs no importer for them.
const ROUTE_DIR = 'app/'
const ROUTE_CONVENTION_EXPORTS = new Set([
  'default',
  'unstable_settings',
  'ErrorBoundary',
  'SuspenseFallback',
  'generateStaticParams',
  'loader',
  'redirectSystemPath',
])

const consumedByConvention = (file: string, name: string): boolean =>
  file.startsWith(ROUTE_DIR) && ROUTE_CONVENTION_EXPORTS.has(name)

const isExempt = (exempt: UnusedExportExemption[], file: string, name: string): boolean =>
  exempt.some((e) => file.startsWith(e.path) && (e.name === undefined || e.name === name))

interface ResolvedModule {
  declared: string[]
  reExports: { target: string | null; imported: string; exported: string }[]
  stars: string[]
}

export function findUnusedExports(
  files: SourceFile[],
  exempt: UnusedExportExemption[] = UNUSED_EXPORT_EXEMPT,
): UnusedExport[] {
  const known = new Set(files.map((f) => f.path))
  const modules = new Map<string, ResolvedModule>()
  const uses: [string, string][] = []
  for (const file of files) {
    const bindings = moduleBindings(file.content)
    const resolve = (spec: string) => resolveImport(file.path, spec, known)
    modules.set(file.path, {
      declared: bindings.declared,
      reExports: bindings.reExports.map((r) => ({ ...r, target: resolve(r.spec) })),
      stars: bindings.stars.map(resolve).filter((t): t is string => t !== null),
    })
    for (const binding of bindings.imports) {
      const target = resolve(binding.spec)
      if (target && target !== file.path) for (const name of binding.names) uses.push([target, name])
    }
  }

  const used = new Set<string>()
  const markUsed = (file: string, name: string) => {
    const key = `${file}\0${name}`
    const module = modules.get(file)
    if (used.has(key) || !module) return
    used.add(key)
    if (name === ALL) {
      for (const declared of module.declared) markUsed(file, declared)
      for (const r of module.reExports) markUsed(file, r.exported)
      for (const star of module.stars) markUsed(star, ALL)
      return
    }
    const reExport = module.reExports.find((r) => r.exported === name)
    if (reExport) {
      if (reExport.target) markUsed(reExport.target, reExport.imported)
      return
    }
    if (!module.declared.includes(name)) for (const star of module.stars) markUsed(star, name)
  }
  for (const [file, name] of uses) markUsed(file, name)

  const unused: UnusedExport[] = []
  for (const [file, module] of modules) {
    const names = [...module.declared, ...module.reExports.map((r) => r.exported)]
    for (const name of names) {
      if (used.has(`${file}\0${name}`) || consumedByConvention(file, name) || isExempt(exempt, file, name)) continue
      unused.push({ file, name })
    }
  }
  return unused.sort((x, y) => x.file.localeCompare(y.file) || x.name.localeCompare(y.name))
}
