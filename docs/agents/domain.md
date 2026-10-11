# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase. This is a single-context repo: one glossary and one ADR directory, both at the root.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: the ADRs that touch the area you're about to work in.
- **`docs/architecture/`**: this repo's written architecture — `seams.md`, `debug-log.md`,
  `native-patches.md` and friends. Read the ones touching your area; `src/architecture/seams.ts` is
  the enforced seam registry those documents explain.

`docs/adr/` exists; `GLOSSARY.md` does not yet. If a file isn't there, **proceed silently**. Don't
flag its absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via
`/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or
decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md                        ← not yet created
├── docs/
│   ├── adr/                           ← exists
│   ├── architecture/                  ← exists: seams, debug log, native patches
│   ├── design/                        ← every feature's spec and plan
│   └── reviews/                       ← review reports and open-work.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in a worklist entry, a refactor proposal, a hypothesis, a
test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary
explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language
the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

The same applies to `docs/architecture/` and to the seam declarations in `src/architecture/seams.ts`:
a seam is inviolable, so a proposal that crosses one is a proposal to change the seam deliberately,
and must say so.
