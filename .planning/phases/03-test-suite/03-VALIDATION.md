---
phase: 3
slug: test-suite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (server)** | Vitest ^3.x |
| **Framework (client)** | Jest via react-scripts 5.0.1 |
| **Config file (server)** | `server/vitest.config.js` — Wave 0 installs |
| **Config file (client)** | Built into react-scripts — no config needed |
| **Quick run command (server)** | `cd server && npx vitest run --reporter=verbose` |
| **Quick run command (client)** | `cd client && npx react-scripts test --watchAll=false` |
| **Full suite command** | `cd server && npx vitest run && cd ../client && npx react-scripts test --watchAll=false` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx vitest run` or `cd client && npx react-scripts test --watchAll=false` (whichever is relevant)
- **After every plan wave:** Run full suite (both server and client)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TEST-01 | unit | `cd server && npx vitest run gameLogic.test.js` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | TEST-02 | integration | `cd server && npx vitest run socket.test.js` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | TEST-04 | integration | `cd server && npx vitest run integration.test.js` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | TEST-03 | unit | `cd client && npx react-scripts test --watchAll=false` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/gameLogic.js` — extract pure functions from server.js (prerequisite for all server tests)
- [ ] `server/server.js` — refactor to factory pattern with `require.main === module` guard
- [ ] `server/vitest.config.js` — Vitest configuration
- [ ] `server/package.json` — add vitest devDependency and test script
- [ ] `client/package.json` — add @testing-library devDependencies
- [ ] `server/gameLogic.test.js` — stubs for TEST-01
- [ ] `server/socket.test.js` — stubs for TEST-02
- [ ] `server/integration.test.js` — stubs for TEST-04
- [ ] `client/src/App.test.js` — stubs for TEST-03

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
