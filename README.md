# On Foot

A hiking app for Android: import a GPX trail, see it on a map with its elevation profile, record a
walk against it, and keep your activities. Built with Expo (SDK 57) and React Native, with Mapbox for
the map and SQLite for storage.

This project is **entirely AI-written**. `AGENTS.md` is the contract every change is held to — read it
before writing code. It is not a style guide; the gates described below enforce most of it.

## Requirements

- Node 22 (the version CI uses)
- An Android SDK and a device or emulator. The app uses the Mapbox native SDK, so **Expo Go will not
  run it** — you need a development build (`npm run android` makes one).
- Two Mapbox tokens, in a `.env` file at the repo root (gitignored, and a test enforces that):

  ```
  MAPBOX_ACCESS_TOKEN=pk....     # runtime: the map itself
  MAPBOX_DOWNLOAD_TOKEN=sk....   # build time: fetching the native SDK from Mapbox's maven repo
  ```

  The download token needs the `DOWNLOADS:READ` scope. Without `.env` the app builds but crashes on
  launch when the map mounts.

## Running it

```bash
npm install          # postinstall applies patches/ via patch-package — don't skip it
npx expo prebuild    # generates android/ (gitignored, regenerate freely)
npm run android      # builds the dev client, installs it, starts the bundler
```

`npm start` alone only starts the bundler; it assumes the dev client is already installed.

## The gate

```bash
npm run verify       # tsc --noEmit && jest && expo lint
```

This must be green before a change is done. It runs in the `pre-push` hook and in CI, so a red gate
blocks the push rather than the review.

`jest` is not only unit tests — it also runs the architecture gates in `src/architecture/`: the
**seam** test (no file may import a native SDK outside its directory), **secrets** (`.env` stays
untracked), **cycles**, **duplication** (verbatim copies of 8+ significant lines), and **import
rules** (one-way directory bans). These are facts, not heuristics: their only escape is a registered
entry with a rationale. Lint rules are heuristics and may instead be answered by a justified inline
`eslint-disable` — see `AGENTS.md` and `docs/architecture/lint-debt.md`.

## Layout

| Path | What lives there |
|---|---|
| `app/` | Routes (expo-router, typed routes on) |
| `src/map/` | Map screen, controls, offline packs; `src/map/providers/` is the only place the map SDK may be imported |
| `src/recording/` | The recording controller, its durable session, and the background location task |
| `src/data/` | Domain types, repositories and pure geo/elevation logic; `src/data/db/` is the only place the database engine may be imported |
| `src/location/`, `src/net/` | Ports wrapping the location and connectivity SDKs |
| `src/log/` | The in-app debug log — the first place to look for a bug reported from the field |
| `src/architecture/` | The gates above, and `seams.ts`, which declares the boundaries |
| `docs/architecture/` | Why the seams, the lint policy, and the debug log are the way they are |
| `docs/superpowers/` | Every feature's spec and plan; features go brainstorm → spec → plan, not straight to code |
| `docs/reviews/` | Whole-codebase reviews and the field findings from device passes |

## Database changes

Schema lives in `src/data/db/schema.ts`. Migrations are generated, never hand-written:

```bash
npm run db:generate   # drizzle-kit; commit the generated .sql and meta/ alongside the schema change
```

They apply on launch, so a migration must be safe against an existing install.

## Platform

Android is the only supported target today. iOS and web files exist because they come with the Expo
template; they are not maintained. Android-only surfaces (the toast, the share-intent module) are
documented as such where they are defined.
