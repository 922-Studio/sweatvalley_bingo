# Phase 1: Docker & Infrastructure - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Get the app running reliably as a single Docker container. Fix the Dockerfile to use one Express process serving both the React build and Socket.io on one port. Fix port mapping (3923:3001), upgrade to Node 20, add health check. No feature changes, no bug fixes — just infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Health check design
- Simple HTTP-only: GET /health returns 200 from Express
- No Socket.io verification — if Express is up, Socket.io is up
- Standard timing: 30s interval, 3 retries, 5s timeout
- Response: status code only, minimal body (e.g., `{"status":"ok"}`)
- Auto-restart on failure via `restart: unless-stopped` (already configured)

### Dev workflow
- docker-compose.yml is production-only — no dev profiles or overrides
- Development uses bare `node server.js` + `npm start` on client directly
- Minimal scripts — keep existing npm scripts in each package.json, no root package.json
- No .env file — hardcode dev defaults (port 3001, localhost), only docker-compose sets NODE_ENV=production

### Build strategy
- Keep multi-stage build: Stage 1 builds React, Stage 2 runs Express (smaller, no dev deps in final image)
- Express serves React build via `express.static('./public')` — replaces http-server
- Single process, single port (3001 internal)
- Remove http-server global install
- Node 20 Alpine base image (`node:20-alpine`)

### Lockfiles and reproducibility
- Do NOT commit lockfiles — they are not tracked in this repo
- Dockerfile uses `npm install` (not `npm ci`) since lockfiles are not committed
- Lockfile-first copy pattern not applicable

### Data volume strategy
- Words.csv baked into the image during build (COPY data)
- Remove the volume mount from docker-compose.yml — container is fully self-contained
- Remove unused `bingo-data` named volume from compose
- Explicit container name: `schweisstal-bingo`

### Claude's Discretion
- Exact Dockerfile layer ordering for optimal caching
- Whether to add .dockerignore
- Internal port number (3001 currently, can change if needed)
- CMD format (exec form vs shell form)

</decisions>

<specifics>
## Specific Ideas

- Container should be fully self-contained — no host dependencies beyond Docker
- Keep it simple: one process, one port, one container
- Home lab server context: auto-boots 05:00, shuts down 22:00 CET — auto-restart matters

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Multi-stage Dockerfile pattern already exists — needs fixing, not rewriting
- docker-compose.yml structure exists — needs port/volume/health updates
- Express server already exists at server/server.js — just needs static serving added

### Established Patterns
- Client is CRA (react-scripts) — `npm run build` produces `build/` directory
- Server uses Express 4.18 + Socket.io 4.5.4 + cors + csv-parse
- Client proxies to localhost:3001 during dev (proxy field in package.json)

### Integration Points
- server/server.js needs `express.static` middleware added to serve React build
- Dockerfile CMD changes from dual-process to single `node server/server.js`
- docker-compose ports change from 3000:3000 + 3001:3001 to 3923:3001

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-docker-infrastructure*
*Context gathered: 2026-03-05*
