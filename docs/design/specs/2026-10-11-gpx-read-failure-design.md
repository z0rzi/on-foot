# A file that cannot be opened says so

Closes the message half of **ERR-2**.

## The problem, as observed

Device check, 2026-10-10: opening a `content://` URI the file layer cannot read raises
**"Not a GPX file / This file could not be read as GPX."**, while the debug log carries the real
cause — `SecurityException: Permission Denial`. The alert names the file's *format* when the file
was never read at all.

The cause is one `catch` covering two different failures (`app/trail/new.tsx`):

```ts
const xml = await readGpxFile(params.uri)   // a read failure throws here
parsed = parseGpx(xml, params.name ?? null) // a parse failure throws here
```

`GpxError` with reason `'empty'` gets its own message; **everything else** falls to the
"Not a GPX file" branch — which is right for a `'format'` error and wrong for a read failure.
The branch is a catch-all standing in for "we didn't recognise this", so an unread file inherits a
verdict about its contents.

## Existing shape

`captureRefusalAlert` (`src/recording/captureAlerts.ts`) is this exact shape already: a pure
function mapping a failure to `{ title, message }`, unit-tested on its own
(`src/recording/__tests__/captureAlerts.test.ts`), called by the component that shows the `Alert`.
Starting and resuming share it so the same refusal is explained in the same words.

This change mirrors it rather than inventing anything: a pure mapper, its own tests, and a component
that only displays the result.

## The change

**1. Name the read failure where it happens.** `src/data/trails/gpx/readFile.ts` wraps whatever the
file layer throws in a `GpxReadError` carrying the original as `cause`. "The read failed" then
becomes a fact the error states, rather than something the caller infers from "nothing else
matched" — which is what made the catch-all wrong.

**2. One pure mapper.** `src/trails/importAlerts.ts` exports
`gpxImportAlert(err: unknown): { title: string; message: string }` with three outcomes:

| failure | title | message |
| --- | --- | --- |
| `GpxReadError` | Could not open the file | The file could not be read. It may have moved, or this app may not have permission to open it. |
| `GpxError` `'format'` | Not a GPX file | This file could not be read as GPX. |
| `GpxError` `'empty'` | No route found | This GPX file has no route or track points to import. |

Anything unrecognised keeps the `'format'` wording, so an unexpected throw degrades to today's
behaviour rather than to no message.

**It lives in `src/trails/`, not `src/data/`.** Alert copy is presentation, and the data layer is
the one place it must not accumulate — that is ARCH-1, and the export gate next door
(`src/architecture/exportRules.ts`) exists because of it. `src/trails/` already consumes
`src/data/trails` (`TrailInfoSheet`, `TrailListItem`, `difficulty.ts`), so the direction is right.

**3. One `catch`.** `app/trail/new.tsx` keeps its single catch, calls the mapper, and logs which of
the three happened instead of calling every non-`empty` failure "unreadable file".

## Testing

The mapper is pure logic, so it is TDD'd like its sibling: one case per outcome plus the unknown
fallback. `readGpxFile` stays a thin wrapper over `expo-file-system` and is not unit-tested. The
classifier (`classifyGpxFailure`) and the copy map (`gpxImportAlert`) are unit-tested; the log
line in `app/trail/new.tsx` is not, since this repo does not unit-test component effects (no React
Testing Library, consistent with other `logEvent` call sites in components) — that line's
cause-preservation is exercised only by reading the code, not by a test.

No device check is needed to *land* this — the failure is an alert, not native rendering — but the
`content://` case from 2026-10-10 is worth re-running to see the new wording, and ERR-2's
still-unexercised `'empty'` message could be caught in the same pass.

## Out of scope

**ERR-6** lives in this same effect: `metricsForSegments` runs after the `try` closes, so a throw
there is an unhandled rejection behind a spinner that never exits. Its recorded fix is "a third
outcome in the same effect", which is the machinery this change introduces — but it is a separate
open finding and is not folded in here.
