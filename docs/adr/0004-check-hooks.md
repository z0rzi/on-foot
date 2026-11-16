# Check hooks live in the owner's own app, compiled in by a flag and callable only by adb

Device checks set up, tear down and read the app through commands it answers over adb, the check
hooks of [[2026-11-15-check-hooks-design]], instead of driving its screens. They live in the
owner's own app, `com.zorzi.onfootrn`, because the app the owner uses every day is the build the
agents make: every agent build sets `EXPO_PUBLIC_DEBUG_CHECK_HOOKS`, and a build without it carries
no dispatcher code and never registers the receiver. What keeps that safe is the receiver's
permission, `android.permission.DUMP`, which adb's shell holds and no installed app can get, the
`DEVCHECK ` rule the app enforces on every write, and hooks that refuse to touch a recording they
did not start (2026-11-15).

**Considered and rejected:** a separate development app beside the owner's, with its own data. It
would make clean-up a wipe and keep checks away from the owner's data entirely, but it drops the
checks that need the owner's real data, downloads offline maps twice, and leaves the owner's daily
app without the agents' builds. A debuggable build, for `run-as` access to the app's files: the
platform runs a debuggable app's native code with fewer optimisations, and the owner hikes with
this build. Deep links: any app or web page can send one, so a command channel on them is open to
everything on the phone.
