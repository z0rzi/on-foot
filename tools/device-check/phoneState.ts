export const APP_PACKAGE = 'com.zorzi.onfootrn'

export type Foreground =
  | { kind: 'on-foot' | 'picker' | 'share-sheet' | 'other'; activity: string }
  | { kind: 'unreadable' }

// From `dumpsys activity activities`: the resumed activity, and whether it is On Foot or a system
// screen On Foot opened (the file picker, the share sheet). Anything else is the owner's.
export function classifyForeground(dumpsysActivities: string): Foreground {
  const m = dumpsysActivities.match(/topResumedActivity=ActivityRecord\{\S+ u\d+ ([^\s}]+)/)
  if (!m) return { kind: 'unreadable' }
  const activity = m[1]
  const [pkg, cls] = activity.split('/')
  if (pkg === APP_PACKAGE) return { kind: 'on-foot', activity }
  if (pkg.endsWith('.documentsui')) return { kind: 'picker', activity }
  if (cls.endsWith('.ChooserActivity')) return { kind: 'share-sheet', activity }
  return { kind: 'other', activity }
}

export type FixIntake = 'taking-fixes' | 'not-taking-fixes' | 'unreadable'

// From `dumpsys activity services <package>`: the app takes fixes exactly while its location
// service runs in the foreground. A paused recording keeps the service bound, not in the foreground.
export function classifyServices(dumpsysServices: string): FixIntake {
  if (!dumpsysServices.includes('ACTIVITY MANAGER SERVICES')) return 'unreadable'
  const records = dumpsysServices.split(/^\s*\* ServiceRecord\{/m).slice(1)
  const locationInForeground = records.some(
    (record) => /^\S+ u\d+ \S+LocationTaskService\}/.test(record) && /^\s*isForeground=true\b/m.test(record),
  )
  return locationInForeground ? 'taking-fixes' : 'not-taking-fixes'
}
