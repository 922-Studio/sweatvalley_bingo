# Requirements: Schweisstal Bingo

**Defined:** 2026-03-05
**Core Value:** Multiple players can join and play bingo together in real-time with zero friction

## v1 Requirements

### Docker & Infrastructure

- [x] **DOCK-01**: App runs as single Express process serving both static React build and Socket.io WebSocket on one port
- [x] **DOCK-02**: Docker container uses Node 20+ base image
- [x] **DOCK-03**: Host port mapping is 3923 (internal 3001)
- [x] **DOCK-04**: Docker Compose includes health check that verifies Express responds
- [x] **DOCK-05**: Dockerfile uses `npm install` (no lockfiles committed per user decision)

### Bug Fixes

- [ ] **BUGF-01**: First complete row, column, or diagonal triggers bingo win (classic bingo rules)
- [ ] **BUGF-02**: Only the game host can trigger "Runde beenden" (end round)
- [ ] **BUGF-03**: Round count is configurable and consistent between client and server
- [ ] **BUGF-04**: generateGrid does not mutate shared input arrays
- [ ] **BUGF-05**: Unused axios dependency removed from client

### Testing

- [ ] **TEST-01**: Server game logic tested with Vitest (generateGrid, checkForLines, win condition)
- [ ] **TEST-02**: Server Socket.io events tested with Vitest (create-game, join-game, mark-word, start-game)
- [ ] **TEST-03**: Client React components tested with Jest via react-scripts
- [ ] **TEST-04**: Integration tests with real Socket.io client-server connections

### CI/CD Pipeline

- [ ] **CICD-01**: GitHub repo created under personal account
- [ ] **CICD-02**: GitHub Actions workflow runs tests on push to main
- [ ] **CICD-03**: Workflow includes version bump via conventional commits
- [ ] **CICD-04**: Workflow deploys via docker compose on self-hosted runner
- [ ] **CICD-05**: Discord notification on deploy success/failure
- [ ] **CICD-06**: Concurrency group cancels previous in-progress runs

### Public Access

- [ ] **ACCS-01**: Cloudflare Tunnel ingress rule routes bingo.922-studio.com to localhost:3923
- [ ] **ACCS-02**: CORS origin locked to https://bingo.922-studio.com (+ local dev origin)
- [ ] **ACCS-03**: Socket.io configured with aggressive ping (10s interval, 5s timeout) for Cloudflare
- [ ] **ACCS-04**: Socket.io uses WebSocket-only transport (no polling fallback)
- [ ] **ACCS-05**: CNAME record for bingo.922-studio.com configured in Cloudflare DNS

### Documentation

- [ ] **DOCS-01**: HomeStructure docs updated with Cloudflare Tunnel setup guide (how to add new services under 922-studio.com subdomains)

## v2 Requirements

### Reconnection

- **RCON-01**: Player can reconnect to active game after disconnect and restore their board state
- **RCON-02**: Server stores game state keyed by player token for reconnection

### Polish

- **PLSH-01**: Sound effects on bingo win
- **PLSH-02**: Confetti animation on bingo
- **PLSH-03**: Mobile-optimized responsive layout

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | Anonymous play with game codes is sufficient |
| Persistent game history / database | In-memory games fine for classroom use case |
| Custom word lists via UI | CSV file editing is sufficient |
| E2E browser tests (Playwright) | Overkill for classroom bingo, high maintenance |
| Container registry (Docker Hub/GHCR) | Single server, no multi-env deployment |
| CRA-to-Vite migration | Out of scope, not needed for this milestone |
| Staging environment | One server, low-stakes app |
| Traefik/Nginx reverse proxy | Using Cloudflare Tunnel instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCK-01 | Phase 1 | Complete |
| DOCK-02 | Phase 1 | Complete |
| DOCK-03 | Phase 1 | Complete |
| DOCK-04 | Phase 1 | Complete |
| DOCK-05 | Phase 1 | Complete |
| BUGF-01 | Phase 2 | Pending |
| BUGF-02 | Phase 2 | Pending |
| BUGF-03 | Phase 2 | Pending |
| BUGF-04 | Phase 2 | Pending |
| BUGF-05 | Phase 2 | Pending |
| TEST-01 | Phase 3 | Pending |
| TEST-02 | Phase 3 | Pending |
| TEST-03 | Phase 3 | Pending |
| TEST-04 | Phase 3 | Pending |
| CICD-01 | Phase 4 | Pending |
| CICD-02 | Phase 4 | Pending |
| CICD-03 | Phase 4 | Pending |
| CICD-04 | Phase 4 | Pending |
| CICD-05 | Phase 4 | Pending |
| CICD-06 | Phase 4 | Pending |
| ACCS-01 | Phase 4 | Pending |
| ACCS-02 | Phase 4 | Pending |
| ACCS-03 | Phase 4 | Pending |
| ACCS-04 | Phase 4 | Pending |
| ACCS-05 | Phase 4 | Pending |
| DOCS-01 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
