# App-log capture: the debug log recorded on the host for the whole of a check — Design

**Status:** Built, [[2026-11-15-app-log-capture]]; its device checks are owed (`docs/tickets/device-checks.md`).
**From:** the owner's question of 2026-11-15 ("why are we reading the log through the UI?"), and
the device check of the logcat mirror that day.
Follows [[2026-11-14-device-check-speed-design]].
**Date:** 2026-11-15

Terms are those of the toolkit and speed specs. New here: the **mirror** is the app's copy of each
debug-log entry in logcat; the **recorder** is the host process that keeps the mirror's lines in
a file; the **capture** is that file.

## Problem Statement

A device check reads the debug log by driving the app to Settings → Debug log and scrolling it:
62 `scroll down` calls (about 3 min) in the Sonnet trial of 2026-11-15, and an entry missed because
a read was scrolled past it. The release build is not debuggable, so the log's database cannot be
pulled.

The first step is built on this branch: `logEvent` mirrors every entry to logcat as one line,
`OnFootLog {json}` under `ReactNativeJS` (`src/log/logcatLine.ts`), and `devcheck log` reads them
from logcat (`tools/device-check/appLog.ts`). Its device check of 2026-11-15 passed on the build,
the format, the Debug log screen's match and `--area`, and failed on the claim that matters most:
logcat's main buffer on the phone is 256 KiB, filled by the phone's location and sensor services
(`mnld`, `SensorService`, `gps_controlller`) and Appium in about 45 s. A kill and relaunch a
minute after launch found only the second process's entries.

The largest buffer the phone's developer options offer, 16 MB, would hold 30 to 40 min at the rate
measured, less while recording, and many checks run longer.

## Solution

- **A recorder on the host** streams the mirror's lines from logcat as they are written, into a
  capture file, for as long as a check runs. Nothing rotates out of the file.
- The toolkit starts it on demand, as it starts the reader; it resumes by itself after the phone
  drops off and comes back; `cleanup` stops it and copies the capture into the check's evidence
  folder.
- `devcheck log` reads the capture, not logcat, and prints its path. The agent reads or greps the
  capture directly as well: it is a plain file of one entry per line.

## User Stories

1. As a device-check agent, I want every debug-log entry of the check, from the app's launch to the end, so that a check of an hour reads its first minute's entries.
2. As a device-check agent, I want the entries of every process of the app in one place, so that a kill and relaunch shows both sides.
3. As a device-check agent, I want the capture to be a file I can grep and Read, so that I search it without a toolkit call per question.
4. As a device-check agent, I want `devcheck log` to print the capture's path, so that I know which file to read.
5. As a device-check agent, I want `log --area` as today, read from the capture.
6. As a device-check agent, I want the recorder started without a step of mine, so that I cannot forget it.
7. As a device-check agent, I want the capture to begin with what logcat still holds, so that a launch shortly before the first command is in it.
8. As a device-check agent, I want `log` to say when the recording began, so that I know an entry older than that is not missing from the app.
9. As a device-check agent, I want the recorder to resume after the phone drops off, without a duplicate line, and the capture to mark the gap, so that I know entries may be missing there.
10. As a device-check agent, I want the capture copied into my evidence folder by `cleanup`, so that my report cites a file that outlives the check.
11. As the owner, I want the recorder stopped by `cleanup`, so that nothing of a check runs on my machine after it.
12. As the owner, I want no setting of my phone changed, so that the check leaves the phone as it found it.
13. As a device-check agent, I want a capture line to carry the time, the process, the level, the area, the message and the detail, so that a grep line is evidence on its own.
14. As a future agent, I want the line format of the capture to be the one `log` prints, so that there is one format to know.

## Implementation Decisions

### The recorder

- **A detached host process** of the toolkit (`recorderProcess.ts`, started by `recorder.ts`),
  started with the toolkit's own runtime (node with tsx's loader, from the starter's `execArgv`) as
  the leader of its own process group, that runs `adb -s <serial> logcat -v threadtime -s ReactNativeJS` with the toolkit's
  pinned adb and keeps only the mirror's lines. Each line goes through the existing pure parser
  (`appLogEntries`) and is appended to the capture in the format below, positions redacted. The
  capture holds no other line of logcat.
- **The first start reads the last ten minutes first**: the recorder runs logcat once with `-d`
  and `-T '<the phone's time ten minutes ago>'`, which prints that stretch and ends, then follows,
  so the capture opens with what logcat still holds of those ten minutes. Every run of logcat is
  bounded by `-T`: a read of the whole buffer scans all of it, and with the buffer at 16 MiB
  (85 MiB of entries) that took 28 s on the phone, past the start's 20 s; a ten-minute read took
  1.4 s. It takes its lock only after that dump, and its starter waits for the lock, so the command
  that started it (a `log` among them) reads a capture already holding those minutes.
- **Resume after a drop.** When the logcat child ends (the phone unplugged, the adb server
  restarted), the recorder waits for the phone (`adb -s <serial> wait-for-device`) and starts
  logcat again with `-T '<time of the last line written>'`, skipping the lines at that time
  already written (`-T` replays nothing older, so no time comparison is needed, and none breaks at
  the turn of the year). It writes a marker line as soon as the phone is back, saying when the phone
  was lost and when it came back, by the host's clock, and that entries older than logcat's buffer
  at that moment are missing. A capture that already ends on a marker gets no second one, so a
  logcat that keeps failing writes one. A recorder that replaces a dead one continues its capture
  the same way, the gap dated from the capture's last write. A recorder that cannot reach adb for
  good (the phone never returns) keeps waiting until `cleanup` or the next start replaces it.
- **A recorder that cannot go on** (the capture unwritable, a crash) writes its cause to a failure
  file beside the lock and exits. The next command that would start a recorder fails with that
  cause, once, and the one after starts a recorder again; `cleanup` reports it beside the
  capture's path.
- **One recorder per phone**, shared across worktrees like the walker and the reader. Its PID is a
  lock file in the per-phone state directory (`phoneStore.ts`, the same `tryLock` and
  `lockHolder`): a live holder is the running recorder; a dead one is replaced. Starting is under a
  start lock, as the reader's is, so two agents never start two; the wait on a start lock is one
  helper of `phoneStore.ts` (`underStartLock`) for both.
- **The capture lives in the per-phone state directory** (`<serial>.app-log.txt`), beside the lock,
  and is opened for append, so a recorder that restarts continues the same file.

### Starting and stopping

- **Every command that reaches the phone ensures the recorder runs** before it does its own work:
  a check is recorded from its first command, `build-has` included, with no step of the agent's,
  and each step of a `do` list asks again. `route` and a usage error do not start it, nor does
  `cleanup`, which stops it and reports a dead one's failure rather than being stopped by it, nor
  `walk status` and `walk stop`, which the skill runs after `cleanup` and which would otherwise
  start a recorder that outlives the check. A recorder that is running costs one lock read.
- **`cleanup` stops it last**, after the reader, once no walk moves: it kills the recorder's process
  group (the recorder and its adb children), copies
  the capture to the evidence folder as the next numbered file (`NN-app-log.txt`), deletes the
  runtime capture, and prints the evidence path. The next check starts a fresh capture.
- A session that dies with the recorder running leaves it running; the next check uses it, and its
  `cleanup` stops it. Its capture then opens with the earlier check's entries, which their times
  tell apart.

### `devcheck log`

- Reads the capture, keeps `--area` as today, prints the header (count, scope, processes), a
  header line opening each process, then the entries, oldest first, then the capture's path.
- A step of `do`, as `labels` is: it reads the capture and touches no screen.
- The header says when the recording began (the time of its first line, or its start when it is
  empty).
- An empty capture says the recording began at that time and that the installed build may predate
  the mirror (`build-has OnFootLog`).

### The capture's line format

- One entry per line: `<MM-DD HH:MM:SS.mmm> <pid> <level> <area> <message>[ <detail JSON>]`, the
  time logcat's, positions redacted. A line logcat cut short (past about 4 KB) is
  `<time> <pid> (cut by logcat) <what came>`. A gap marker starts with `--- `.
- `log` prints the same lines; its process header lines start with `--- ` too, so no entry line is
  mistaken for one.

## Testing Decisions

- **The seam stays the pure core**, as the toolkit's tests are: no test spawns the recorder, adb
  or a fake logcat. New pure units and their cases:
  - an entry to its capture line and back (the format above, a cut line, a detail with spaces);
  - the resume point: the `-T` time from the last line written, and which lines of a resumed
    stream are already written;
  - the gap marker from the times lost and back, and no second one on a capture ending on one;
  - `log`'s report from capture text: processes, `--area`, the recording's start, empty, a gap
    marker kept in place.
- The cross-check test already holds the toolkit's reader to the app's writer; it stays and covers
  the capture's path through `appLogEntries`.
- **Device-verified, each able to fail** (owed to `docs/tickets/device-checks.md` while the phone
  is taken by another check):
  - a launch shortly before the first command is in the capture;
  - a kill and relaunch more than two minutes after launch: both processes in `log`;
  - a check of over an hour: the first minute's entries in `log` at the end;
  - the phone unplugged and plugged back: the recorder resumes, one gap marker, no line twice;
  - `cleanup`: no recorder process left on the host, `NN-app-log.txt` in the evidence folder;
  - the reader and the recorder running together through a check.

## Existing shape

- **The reader** (`tools/device-check/reader.ts`) is the first instance of "a process the toolkit
  starts on demand, one per phone, shared across worktrees, stopped by `cleanup`, reused after a
  dead session". The recorder is the second: it takes the same per-phone state directory and the
  same `tryLock`/`lockHolder` from `phoneStore.ts`, a start lock beside the reader's, and the same
  place in `cleanup`. What differs is that it runs on the host, not the phone, and resumes by
  itself. If a shared "ensure a per-phone process" helper falls out of the two without bending
  either, it is extracted; the reader's start (instrumentation, HTTP status, battery freeze) and
  the recorder's (a host child) share only the lock dance, which `phoneStore.ts` already holds.
- **`appLogEntries`** (`tools/device-check/appLog.ts`) is the only parser of the mirror; the
  recorder calls it per line, and `log` reads the capture through one parser of the capture
  format.
- **Evidence naming** goes through `evidence.ts` as `shot` and `frames` do.

## Failure modes

| Mode | Visible outcome | Recovery |
|---|---|---|
| The recorder starts more than ten minutes after the app launched, or after logcat's buffer rotated past the launch (about 45 s at 256 KiB) | The capture opens later than the launch; `log`'s header gives the recording's start | Relaunch the app if the launch entries are the evidence |
| The installed build predates the mirror | `log` says the capture is empty and points at `build-has OnFootLog` | Build |
| The phone drops off and comes back | One gap marker in the capture; the stream resumes with no line twice | None needed; entries older than the buffer at the gap may be missing, as the marker says |
| The phone never comes back | The recorder waits; the command that lost the phone reports `phone gone` as today | `blocked`; `cleanup` later stops the recorder |
| The adb server restarts under the recorder | The logcat child ends; the recorder resumes as after a drop | None needed |
| A session dies with the recorder running | It keeps recording; the next check uses it | That check's `cleanup` stops it |
| Two agents start it at once | The second waits on the start lock, then finds it running | None needed |
| Another agent's `cleanup` stops it mid-check | The capture goes to that agent's evidence folder; this check's next command starts a fresh one | Out of scope (two agents on one phone, as in the speed spec) |
| The recorder is killed | The next command finds the lock's holder dead and starts a new recorder, which marks the gap and resumes from the capture's last line | None needed |
| The recorder crashes, or the capture cannot be written (disk full, directory gone) | It leaves its cause and exits; the next command fails with that cause, the one after starts a recorder again; `cleanup` reports it | Free the disk; report the cause if it repeats |
| A host reboot | The runtime directory is gone with the recorder and the capture | The next command starts a fresh one |
| A line cut by logcat | Kept as `(cut by logcat)` with what came | Read the entry in the app's Debug log screen |

## Out of Scope

- Changing the phone's logcat buffer size.
- `native-errors` reading the same 45 s buffer: it keeps reading logcat as today. Recording its
  tags too is a follow-up if a check misses a launch-time native error.
- Pulling the app's database; a debuggable release build.
- Two agents on one phone.
- Any change to the mirror's format in the app.

## Further Notes

- The mirror's device check of 2026-11-15: the build with the mirror installed at 15:14:27; `log`
  printed the 9 launch entries, the same as the Debug log screen; after a kill and relaunch at
  15:15:20 only process 17522's entries were left, the main buffer's oldest line at 15:14:47
  (`logcat -g`: 256 KiB).
