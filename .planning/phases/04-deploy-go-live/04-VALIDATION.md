---
phase: 4
slug: deploy-go-live
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (server), Jest 27 via react-scripts 5 (client) |
| **Config file** | server: inline in package.json, client: react-scripts built-in |
| **Quick run command** | `cd server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd server && npm test && cd ../client && npx react-scripts test --watchAll=false` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npm test`
- **After every plan wave:** Run `cd server && npm test && cd ../client && npx react-scripts test --watchAll=false`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | ACCS-02 | unit | `curl -H "Origin: https://evil.com" -I http://localhost:3923` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | ACCS-03 | unit | `cd server && npx vitest run` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | ACCS-04 | unit | `cd server && npx vitest run` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | CICD-02 | integration | Push to main, check Actions tab | N/A | ⬜ pending |
| 4-02-02 | 02 | 1 | CICD-03 | integration | Push feat commit, check version | N/A | ⬜ pending |
| 4-02-03 | 02 | 1 | CICD-04 | smoke | `curl -f http://localhost:3923/health` | N/A | ⬜ pending |
| 4-02-04 | 02 | 1 | CICD-05 | manual-only | Check Discord channel after deploy | N/A | ⬜ pending |
| 4-02-05 | 02 | 1 | CICD-06 | manual-only | Push twice rapidly, check Actions | N/A | ⬜ pending |
| 4-03-01 | 03 | 2 | ACCS-01 | smoke | `curl -f https://bingo.922-studio.com/health` | N/A | ⬜ pending |
| 4-03-02 | 03 | 2 | ACCS-05 | manual-only | `dig bingo.922-studio.com` | N/A | ⬜ pending |
| 4-03-03 | 03 | 2 | DOCS-01 | manual-only | File exists check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — this phase is primarily configuration (workflow YAML, server config changes, DNS setup) rather than new application code. Existing test infrastructure from Phase 3 covers the test-running requirement (CICD-02).

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub repo created | CICD-01 | One-time manual setup | Create private repo, add self-hosted runner |
| Discord notification | CICD-05 | Requires external service check | Push to main, verify Discord message appears |
| Concurrency cancellation | CICD-06 | Requires rapid sequential pushes | Push twice in <30s, verify first run cancelled |
| CNAME record configured | ACCS-05 | DNS configuration in Cloudflare dashboard | Run `dig bingo.922-studio.com`, verify CNAME |
| HomeStructure docs | DOCS-01 | Documentation review | Verify file exists and content is accurate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
