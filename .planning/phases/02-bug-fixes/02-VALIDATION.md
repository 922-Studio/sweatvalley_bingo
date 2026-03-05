---
phase: 2
slug: bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (Phase 3 scope — Vitest for server, Jest for client) |
| **Config file** | none — no test infra yet |
| **Quick run command** | Manual verification |
| **Full suite command** | Manual verification |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual verification of changed behavior
- **After every plan wave:** Verify all 5 bug fixes manually
- **Before `/gsd:verify-work`:** All behaviors manually confirmed
- **Max feedback latency:** ~60 seconds (manual browser test)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BUGF-01 | manual | Start game, complete one row, verify win | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | BUGF-02 | manual | Join as non-host, verify no "Runde beenden" button | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | BUGF-04 | manual | Start with 3+ players, verify unique grids | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | BUGF-05 | unit | `grep -r "axios" client/package.json` returns nothing | N/A | ⬜ pending |
| 02-02-01 | 02 | 1 | BUGF-03 | manual | Set 3 rounds, play through, verify ends after 3 | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework needed — Phase 3 adds automated tests for these behaviors.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First line triggers win | BUGF-01 | No test infra yet | Start game, mark full row, verify win popup |
| Host-only end round | BUGF-02 | No test infra yet | Open 2 browsers, join as non-host, verify no button |
| Round count config | BUGF-03 | No test infra yet | Set maxRounds=3, play 3 rounds, verify game ends |
| Unique grids | BUGF-04 | No test infra yet | Start with 3 players, compare grid contents |
| Axios removed | BUGF-05 | Simple check | `grep axios client/package.json` returns empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
