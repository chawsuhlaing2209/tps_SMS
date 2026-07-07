# Testing results

One file per testing phase, newest last. Each phase of
[localhost-test-plan.md](../localhost-test-plan.md) gets a dated result log
here so we always know what was tested, when, what failed, and what was done
about it. Staging/production release rehearsals continue the same numbering.

| Phase | Scope | File naming |
|---|---|---|
| Phase 1 | P0 automated tests (money + irreversible actions) | `phase-1-*.md` |
| Phase 2 | P1/P2 automated tests | `phase-2-*.md` |
| Phase 3 | Manual feature pass on localhost (test plan Part C) | `phase-3-*.md` |
| Phase 4 | Staging rehearsal pass | `phase-4-*.md` |
| Releases | Production release smoke tests | `release-vX.Y.Z.md` |

Conventions:

- Record **failures honestly** — a failed test that led to a fix is the
  system working, not something to hide. Every bug found gets a line linking
  the fix and the regression test that now guards it.
- Severity for manual findings: **blocker** (money wrong, data loss,
  cross-tenant leak) / **major** (feature broken) / **minor** (cosmetic).
- A phase is *done* when its log has a Result line and zero open blockers.
