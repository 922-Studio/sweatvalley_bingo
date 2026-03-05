# Roadmap: Schweisstal Bingo

## Overview

Transform the existing functional-but-buggy classroom bingo app into a production-ready deployment. Fix the Docker setup so it runs correctly as a single container, fix the game logic bugs, add automated tests to verify everything works, then wire up CI/CD and public access so the app is live at bingo.922-studio.com. Four phases, each building on the last: working container, working game, verified game, shipped game.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Docker & Infrastructure** - Single-container setup with correct Node version, port mapping, and build process
- [ ] **Phase 2: Bug Fixes** - Classic bingo win condition, host-only controls, consistent rounds, no array mutation
- [ ] **Phase 3: Test Suite** - Server and client tests verifying game logic, Socket.io events, and components
- [ ] **Phase 4: Deploy & Go Live** - CI/CD pipeline, Cloudflare Tunnel, public access at bingo.922-studio.com

## Phase Details

### Phase 1: Docker & Infrastructure
**Goal**: The app runs reliably as a single Docker container with correct configuration
**Depends on**: Nothing (first phase)
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05
**Success Criteria** (what must be TRUE):
  1. `docker compose up` starts the app and it responds to HTTP requests on localhost:3923
  2. Container runs a single Express process serving both the React build and Socket.io on one port
  3. Container health check passes and `docker compose ps` shows healthy status
  4. Rebuilding the container produces identical results (reproducible builds via lockfiles)
**Plans:** 1 plan

Plans:
- [x] 01-01-PLAN.md — Fix Docker setup: Node 20, single process, port 3923, health check, static serving

### Phase 2: Bug Fixes
**Goal**: The bingo game plays correctly with classic rules and proper host controls
**Depends on**: Phase 1
**Requirements**: BUGF-01, BUGF-02, BUGF-03, BUGF-04, BUGF-05
**Success Criteria** (what must be TRUE):
  1. Completing a full row, column, or diagonal on the bingo grid triggers a win
  2. Only the host player sees and can use the "Runde beenden" button
  3. Host can configure number of rounds and both client and server respect that setting
  4. Each player gets a unique grid without the shared word array being mutated between calls
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Test Suite
**Goal**: Automated tests verify game logic, real-time events, and UI components
**Depends on**: Phase 2
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. `npm test` on the server runs Vitest and passes tests for generateGrid, checkForLines, and win condition logic
  2. Socket.io event handlers (create-game, join-game, mark-word, start-game) are tested with mocked or real connections
  3. Client React components render correctly in Jest tests via react-scripts
  4. At least one integration test connects a real Socket.io client to a real server and verifies end-to-end message flow
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Deploy & Go Live
**Goal**: Automated pipeline deploys the app and it is publicly accessible at bingo.922-studio.com
**Depends on**: Phase 3
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04, CICD-05, CICD-06, ACCS-01, ACCS-02, ACCS-03, ACCS-04, ACCS-05, DOCS-01
**Success Criteria** (what must be TRUE):
  1. Pushing to main triggers a GitHub Actions workflow that runs tests, bumps version, deploys via Docker Compose, and sends a Discord notification
  2. The app is reachable at https://bingo.922-studio.com and WebSocket connections work through Cloudflare Tunnel
  3. CORS is locked to the production domain (plus localhost for dev) and Socket.io uses WebSocket-only transport
  4. HomeStructure docs include a guide for adding new services under 922-studio.com subdomains via Cloudflare Tunnel
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Docker & Infrastructure | 1/1 | Complete | 2026-03-05 |
| 2. Bug Fixes | 0/2 | Not started | - |
| 3. Test Suite | 0/2 | Not started | - |
| 4. Deploy & Go Live | 0/3 | Not started | - |
