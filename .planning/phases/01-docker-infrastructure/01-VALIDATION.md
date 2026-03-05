---
phase: 1
slug: docker-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (docker compose + curl) |
| **Config file** | docker-compose.yml |
| **Quick run command** | `docker compose up --build -d && sleep 5 && curl -f http://localhost:3923/health` |
| **Full suite command** | `docker compose up --build -d && sleep 10 && curl -f http://localhost:3923/health && docker compose ps --format json` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose up --build -d && sleep 5 && curl -f http://localhost:3923/health`
- **After every plan wave:** Run `docker compose up --build -d && sleep 10 && curl -f http://localhost:3923/health && docker compose ps --format json`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DOCK-01 | smoke | `curl -f http://localhost:3923/ && curl -f http://localhost:3923/health` | N/A (infra) | ⬜ pending |
| 01-01-02 | 01 | 1 | DOCK-02 | smoke | `docker compose exec bingo node --version` | N/A (infra) | ⬜ pending |
| 01-01-03 | 01 | 1 | DOCK-03 | smoke | `curl -f http://localhost:3923/health` | N/A (infra) | ⬜ pending |
| 01-01-04 | 01 | 1 | DOCK-04 | smoke | `docker compose ps` (shows "healthy") | N/A (infra) | ⬜ pending |
| 01-01-05 | 01 | 1 | DOCK-05 | manual | Rebuild twice, compare behavior | N/A (infra) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No test framework needed — this is infrastructure testing via Docker commands and curl.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reproducible builds | DOCK-05 | Requires two separate builds and comparison | Build twice with `docker compose build`, verify both produce working containers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
