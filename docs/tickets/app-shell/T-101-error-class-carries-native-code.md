---
severity: minor
category: enhancement
size: S
triage:
origin: agent
filed: 2026-11-14
from: "code review of DUP-2 ([[2026-11-14-full-review]])"
blocked_by: []
---
# T-101: a native rejection reaches the debug log as `errorClass: 'Error'`, its code dropped

Since DUP-2, every handled failure logs `{ errorClass: errorClass(error) }`, the error's `name`
(`src/log/errorClass.ts:2-4`). Expo's `CodedError` never sets `name`
(`node_modules/expo-modules-core/src/errors/CodedError.ts:6-13`), so a rejection from an Expo
module logs `'Error'`, the same class as any other failure. That covers the GPX read cause
(`app/trail/new.tsx:43`, a permission error and a missing file read the same), the SQLite reads
behind the list loads and saves, and the location stream start. Before DUP-2 the message told
these apart. It could also quote data, which is why it went.

`CodedError` carries a `code` (`ERR_INTERNAL_SQLITE_ERROR`; Kotlin `CodedException`s with no code
take one from their class name, e.g. `expo-sqlite`'s `OpenDatabaseException`,
`node_modules/expo-sqlite/android/src/main/java/expo/modules/sqlite/SQLExceptions.kt:8`). A code is
a fixed identifier, never the data at fault, so it fits the rule in `docs/architecture/debug-log.md`
"Errors in the log".

Possible fix: `errorClass` returns the code when the error has a non-empty string `code`, and the
name otherwise. The rule's wording and `errorClass`'s tests change with it. Before building, check
on device that a rejected native call reaches JS with `code` set (one forced failure, e.g. a GPX
import of a file that was deleted).
