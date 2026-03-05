---
phase: 01-docker-infrastructure
plan: 01
subsystem: infra
tags: [docker, node20, express-static, health-check, alpine]

# Dependency graph
requires:
  - phase: none
    provides: "First phase, no dependencies"
provides:
  - "Working single-container Docker setup with Node 20 Alpine"
  - "Express static serving replacing http-server (single process)"
  - "Health check endpoint at /health"
  - "Port mapping 3923:3001"
  - "docker-compose.yml with healthcheck config"
affects: [02-bug-fixes, 03-test-suite, 04-deploy-go-live]

# Tech tracking
tech-stack:
  added: [node-20-alpine, wget-healthcheck]
  patterns: [single-process-container, express-static-spa, exec-form-cmd]

key-files:
  created: []
  modified:
    - Dockerfile
    - docker-compose.yml
    - server/server.js

key-decisions:
  - "Used wget instead of curl for health check (Alpine includes wget by default)"
  - "Used 127.0.0.1 instead of localhost in health check to avoid IPv6 resolution issues"
  - "Used npm install (not npm ci) since no lockfiles are committed (per user decision)"
  - "SPA catch-all route uses path.join(__dirname, '../public') for correct Docker path resolution"

patterns-established:
  - "Single Express process: serve static files + API + WebSocket on one port"
  - "Health check pattern: /health endpoint returning JSON {status: ok}"
  - "Docker exec-form CMD: CMD [\"node\", \"server/server.js\"]"

requirements-completed: [DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05]

# Metrics
duration: ~15min
completed: 2026-03-05
---

# Phase 1 Plan 1: Docker Infrastructure Summary

**Single-container Node 20 Alpine setup with Express static serving, /health endpoint, and port 3923 mapping replacing broken dual-process http-server config**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-05T11:30:00Z
- **Completed:** 2026-03-05T11:50:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Upgraded Docker base image from Node 18 to Node 20 Alpine
- Eliminated http-server dependency; Express now serves React build via express.static
- Added /health endpoint and Docker Compose healthcheck with wget
- Consolidated from dual-port (3000+3001) dual-process to single-port (3001) single-process
- Port mapping changed to 3923:3001 as required

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Dockerfile and docker-compose.yml** - `01f16db` (feat)
2. **Task 2: Add static serving and health endpoint to server.js** - `aec9aa4` (feat)
3. **[Rule 1 - Bug] Fix health check IPv6 issue** - `f95ba7f` (fix)
4. **Task 3: Verify Docker container runs correctly** - checkpoint:human-verify (approved by user)

## Files Created/Modified
- `Dockerfile` - Multi-stage build with Node 20 Alpine, single exec-form CMD, no http-server
- `docker-compose.yml` - Port 3923:3001, healthcheck with wget, container name, no volumes, no version field
- `server/server.js` - Added express.static for React build, /health endpoint, SPA catch-all route

## Decisions Made
- Used wget instead of curl for health check since Alpine includes wget but not curl
- Used 127.0.0.1 instead of localhost in Docker health check to avoid IPv6 resolution issues in Alpine containers
- Kept npm install (not npm ci) since user decided not to commit lockfiles
- SPA catch-all route placed after Socket.io handlers but before server.listen

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed health check IPv6 resolution issue**
- **Found during:** Task 3 verification (container showed unhealthy)
- **Issue:** Docker health check used `localhost` which resolved to IPv6 `::1` in Alpine, but Express was listening on `0.0.0.0` (IPv4 only)
- **Fix:** Changed health check URL from `http://localhost:3001/health` to `http://127.0.0.1:3001/health`
- **Files modified:** docker-compose.yml
- **Verification:** Container status changed to healthy after fix
- **Committed in:** `f95ba7f`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for health check to work correctly in Alpine containers. No scope creep.

## Issues Encountered
- User reported "Ich kann kein Spiel erstellen" (cannot create a game) -- this is a pre-existing app bug unrelated to Docker infrastructure. Will be addressed in Phase 2 (Bug Fixes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Docker infrastructure complete, container builds and runs healthy
- Ready for Phase 2: Bug Fixes (game logic issues including the reported game creation bug)
- Pre-existing app bugs are known and documented for Phase 2

---
*Phase: 01-docker-infrastructure*
*Completed: 2026-03-05*
