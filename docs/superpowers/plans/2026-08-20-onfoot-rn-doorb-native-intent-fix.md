# Door B Native-Intent Redirect Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the OS "open with" GPX path (Door B) so opening a `.gpx` from another app routes into the add-GPX form instead of expo-router's "Unmatched Route."

**Architecture:** Replace the racing manual `Linking` handler in `app/_layout.tsx` with expo-router's official `redirectSystemPath` hook in `app/+native-intent.ts`, which intercepts the raw incoming URL before route-matching and redirects file-open URIs (`content://`/`file://`) into `/trail/new`.

**Tech Stack:** Expo SDK 57, expo-router 57.0.14, TypeScript, Jest.

## Global Constraints

- **Read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing native/config code.** (AGENTS.md)
- Pure logic is TDD'd (`src/**/__tests__/` or co-located `__tests__/`); native open-with is device-verified.
- Persistence seam untouched; no `expo-sqlite`/`drizzle-orm` imports added.
- Comment style (AGENTS.md): no change-narrating comments; self-documenting; comment only genuinely non-obvious *why*.
- `redirectSystemPath` must pass non-file-open links through unchanged (the app's own `onfootrn://` scheme, `https://` app links).
- Redirect target: `/trail/new?uri=<encodeURIComponent(path)>`. The form (`app/trail/new.tsx`) already reads `params.uri` and falls back for the name to `parsed.title ?? params.name ?? ''` — do not change it.

---

## File Structure

**Create**
- `app/+native-intent.ts` — exports `redirectSystemPath({ path, initial })`; pure string→string redirect. expo-router auto-discovers this filename.
- `app/__tests__/native-intent.test.ts` — unit tests for `redirectSystemPath`.

**Modify**
- `app/_layout.tsx` — remove `useGpxOpenHandler` and its now-unused imports (`expo-linking`, `router`, `useEffect`); keep migration gating intact.

---

### Task 1: native-intent redirect + remove the manual handler

**Files:**
- Create: `app/+native-intent.ts`
- Test: `app/__tests__/native-intent.test.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string`
- expo-router calls this automatically (verified in installed `expo-router/build/getLinkingConfig.js` + `build/link/linking.js`) for the initial URL (`initial: true`) and every `url` event (`initial: false`); the returned string becomes the routed href.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/native-intent.test.ts`:
```ts
import { redirectSystemPath } from '../+native-intent'

describe('redirectSystemPath', () => {
  test('redirects a content:// file-open URI into the add-GPX form, uri-encoded', () => {
    const path = 'content://media/external/downloads/1000058466'
    const result = redirectSystemPath({ path, initial: true })
    expect(result).toBe(`/trail/new?uri=${encodeURIComponent(path)}`)
    const uri = new URLSearchParams(result.split('?')[1]).get('uri')
    expect(uri).toBe(path)
  })

  test('redirects a file:// .gpx URI into the add-GPX form', () => {
    const path = 'file:///storage/emulated/0/Download/hike.gpx'
    const result = redirectSystemPath({ path, initial: false })
    expect(result).toBe(`/trail/new?uri=${encodeURIComponent(path)}`)
  })

  test('passes the app deep-link scheme through unchanged', () => {
    expect(redirectSystemPath({ path: 'onfootrn://trail/new', initial: false })).toBe('onfootrn://trail/new')
  })

  test('passes an https app link through unchanged', () => {
    expect(redirectSystemPath({ path: 'https://example.com/x', initial: true })).toBe('https://example.com/x')
  })

  test('passes an in-app absolute path through unchanged', () => {
    expect(redirectSystemPath({ path: '/trail/new', initial: false })).toBe('/trail/new')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/__tests__/native-intent.test.ts`
Expected: FAIL — cannot find module `../+native-intent`.

- [ ] **Step 3: Create the native-intent module**

Create `app/+native-intent.ts`:
```ts
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (path.startsWith('content://') || path.startsWith('file://')) {
    return `/trail/new?uri=${encodeURIComponent(path)}`
  }
  return path
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/__tests__/native-intent.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Remove the superseded manual handler from `app/_layout.tsx`**

Replace the entire contents of `app/_layout.tsx` with:
```tsx
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useDatabaseMigrations } from '../src/data/db/useDatabaseMigrations'

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text>Database failed to initialize: {error.message}</Text>
        </View>
      ) : success ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : null}
    </GestureHandlerRootView>
  )
}
```
(Removes `useGpxOpenHandler` and the `expo-linking`, `router`, `useEffect` imports it required. Migration gating is unchanged.)

- [ ] **Step 6: Typecheck + full suite + seam audit**

Run: `npx tsc --noEmit` → clean.
Run: `npx jest` → green (existing suites + the new native-intent suite).
Run: `grep -rn "drizzle-orm\|expo-sqlite" src app | grep -v "src/data/db/"` → prints nothing.
Run: `grep -rn "useGpxOpenHandler\|expo-linking" app/_layout.tsx` → prints nothing (handler fully removed).

- [ ] **Step 7: Commit**

```bash
git add "app/+native-intent.ts" "app/__tests__/native-intent.test.ts" "app/_layout.tsx"
git commit -m "fix: route GPX open-with via expo-router native-intent redirect (Door B)"
```

---

## Device Verification (controller/user, after Task 1)

No native rebuild required — this is a JS-only change and the GPX intent filter
already ships in the installed build. Reload JS (Metro), then:

1. **Cold start:** with the app fully closed, "Open with → On Foot" on a `.gpx`
   from a file manager (or fire `am start -a android.intent.action.VIEW -d
   content://media/external/downloads/<id> -t application/gpx+xml -n
   com.zorzi.onfootrn/.MainActivity --grant-read-uri-permission`). Expect the
   **"New Trail" form** with the GPX's metrics + name — NOT "Unmatched Route".
2. **Warm start:** with the app already open on the Map/Trails tab, trigger the
   same open-with. Expect it to navigate to the form.
3. **Save** from the form → returns to the Trails list with the new trail.
4. **Regression:** normal app launch (`MAIN`/`LAUNCHER`) still boots to the Map
   tab; Door A (in-app picker) still works.

## Self-Review

- **Spec coverage:** `redirectSystemPath` (spec §Design) → Task 1 Steps 1-4;
  `_layout.tsx` handler removal (spec §Design) → Step 5; reader/form unchanged
  (spec §Unchanged) → not touched, verified in device step 3; device verify
  (spec §Testing) → Device Verification section. Complete.
- **Placeholder scan:** none.
- **Type consistency:** `redirectSystemPath({ path, initial })` signature matches
  the spec and the expo-router call site; redirect target `/trail/new?uri=…`
  matches the form's existing `params.uri` consumer.
