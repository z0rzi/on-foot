# Ticket Conventions Check Implementation Plan

**Goal:** Enforce the worklist ticket conventions in `npm run verify`.

**Spec:** `docs/design/specs/2026-10-26-ticket-conventions-check-design.md`

## Global Constraints

- Pure checker, unit-tested first; the real-tree test mirrors `seams.test.ts`.
- `yaml` becomes a direct devDependency at the version line already resolved (2.9.x); no other new
  package.
- NO JSDoc. Comments explain *why* only.

### Task 1: the checker, test-first

**Files:**
- Create: `src/architecture/tickets.ts`
- Test: `src/architecture/__tests__/tickets.test.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- `TicketFile = { name: string; content: string }`
- `TicketViolation = { file: string; problem: string }`
- `findTicketViolations(files: TicketFile[]): TicketViolation[]`
- `collectTicketFiles(dir?: string, rootDir?: string): TicketFile[]`, throwing when the folder is
  missing.

- [x] Write unit cases, one per spec rule and failure mode, plus a valid ticket that passes; watch
      them fail.
- [x] Implement until green.
- [x] Add the real-tree test; fix any existing ticket it flags.

### Task 2: docs

- [x] `docs/agents/issue-tracker.md`: name the test, state that `severity`/`size` may be empty.
- [x] `npm run verify` green.
