# Post-work review is a standards-and-spec review, not a checklist

Until 2026-10-11 every unit of work ended with `/retro-quality`: a bespoke agent walking a six-check
procedure (`POST-WORK.md`) and told, by an after-the-fact list from the implementer, which decisions
not to question. We replaced it with `/_last-checks`, a thin command over `/code-review`: the
Standards axis reads `CODING_STANDARDS.md` (review-time judgement calls only; the `AGENTS.md`
principles are its base and `npm run verify` owns everything mechanical) and the Spec axis reads the
feature's spec, written before the code. The checklist was deleted rather than kept as a parallel
standard because two homes for the same rules drift, and because a procedure cannot be grown by
`/retro` the way a standards file can. Degraded-mode handling moved into the spec as a mandatory
`## Failure modes` section, alongside `## Existing shape`, so it is reviewed as a requirement.

**Consequence:** a decision that deserves not to be re-litigated belongs in the spec, not in the
review prompt. Spec-less work gets the Standards axis only.
