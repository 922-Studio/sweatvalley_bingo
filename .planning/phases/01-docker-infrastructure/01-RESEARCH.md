# Phase 1: Docker & Infrastructure - Research

**Researched:** 2026-03-05
**Domain:** Docker, Node.js containerization, Express static serving
**Confidence:** HIGH

## Summary

This phase transforms an existing but broken Docker setup into a working single-container deployment. The current Dockerfile runs two processes (Express + http-server), exposes two ports, and uses Node 18. The target is a single Express process serving both the React build and Socket.io on one port (3001 internal, 3923 external), using Node 20 Alpine, with a health check.

All changes are well-understood infrastructure patterns. The existing code already has the right structure -- Express app, Socket.io on the same server, CRA client with `npm run build`. The work is surgical: update Dockerfile, update docker-compose.yml, add `express.static` to server.js, add a `/health` route.

**Primary recommendation:** Fix Dockerfile and docker-compose.yml first, then add static serving and health check to server.js. Verify with `docker compose up` and curl.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Health check: Simple HTTP GET /health returning 200, 30s interval, 3 retries, 5s timeout
- Dev workflow: docker-compose.yml is production-only, no dev profiles
- No .env file: hardcode dev defaults, only docker-compose sets NODE_ENV=production
- Multi-stage build: Stage 1 builds React, Stage 2 runs Express
- Express serves React via `express.static('./public')`, replaces http-server
- Single process, single port (3001 internal)
- Node 20 Alpine base image (`node:20-alpine`)
- No committed lockfiles: use `npm install` (not `npm ci`)
- Words.csv baked into image, remove volume mount and named volume
- Explicit container name: `schweisstal-bingo`
- Auto-restart via `restart: unless-stopped` (already configured)

### Claude's Discretion
- Exact Dockerfile layer ordering for optimal caching
- Whether to add .dockerignore (already exists)
- Internal port number (3001 currently, can change if needed)
- CMD format (exec form vs shell form)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOCK-01 | Single Express process serving React build + Socket.io on one port | Add `express.static` middleware to server.js, remove http-server from Dockerfile, single CMD |
| DOCK-02 | Node 20+ base image | Change `FROM node:18-alpine` to `FROM node:20-alpine` in both stages |
| DOCK-03 | Host port 3923, internal 3001 | Change docker-compose ports from `3000:3000` + `3001:3001` to `3923:3001` |
| DOCK-04 | Health check in Docker Compose | Add healthcheck config with `curl` or `wget` to GET /health; add /health route to Express |
| DOCK-05 | Reproducible builds (user override: `npm install` without lockfiles) | User explicitly decided against `npm ci` + lockfiles; use `npm install` for reproducibility within constraints |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node | 20-alpine | Runtime base image | LTS, user decision |
| express | 4.18.x | HTTP server + static files | Already in project |
| socket.io | 4.5.x | WebSocket server | Already in project |
| react-scripts | 5.0.1 | CRA build toolchain | Already in project |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Docker | Multi-stage | Build + runtime separation | Standard for Node apps |
| Docker Compose | v3.8 | Container orchestration | Single container, but manages config |

### Not Needed
| Tool | Why Not |
|------|---------|
| http-server | Replaced by express.static |
| nginx | Overkill, Express handles static serving fine |
| pm2 | Single process, Docker handles restart |
| package-lock.json | User decision: not committed |

## Architecture Patterns

### Recommended Dockerfile Structure
```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS builder
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/src ./src
COPY client/public ./public
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --production
COPY server/server.js ./server/
COPY data ./data
COPY --from=builder /app/client/build ./public
EXPOSE 3001
CMD ["node", "server/server.js"]
```

**Key layer ordering decisions (Claude's discretion):**
1. Copy package.json first, install, then copy source -- leverages Docker layer caching
2. Use exec form `CMD ["node", "server/server.js"]` -- receives SIGTERM properly for graceful shutdown
3. Keep internal port as 3001 -- no reason to change, server.js already listens on 3001
4. .dockerignore already exists and is adequate -- covers node_modules, .git, build artifacts

### Express Static Serving Pattern
```javascript
// Add BEFORE Socket.io event handlers, AFTER middleware
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

**Why `path.join(__dirname, '../public')`:** In Docker, the layout is `/app/public` and `/app/server/server.js`. The `__dirname` is `/app/server`, so `../public` resolves to `/app/public`. This also works in development if the client build is at `../public` (though dev uses CRA dev server instead).

### docker-compose.yml Structure
```yaml
services:
  bingo:
    build: .
    container_name: schweisstal-bingo
    ports:
      - "3923:3001"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

**Note:** Use `wget` instead of `curl` for health check -- Alpine images include `wget` by default but NOT `curl`. This avoids adding `curl` to the image.

### Anti-Patterns to Avoid
- **Running multiple processes in CMD:** Current `sh -c "node server.js & http-server"` is fragile -- if one dies the other keeps running, container appears healthy. Single process is correct.
- **Shell form CMD:** `CMD node server.js` runs under `/bin/sh -c` which doesn't forward signals. Use exec form `CMD ["node", "server/server.js"]`.
- **EXPOSE matching host port:** `EXPOSE 3923` would be wrong -- EXPOSE documents the internal port (3001). Port mapping happens in compose.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving | Custom file-read handler | `express.static()` | Handles MIME types, caching headers, range requests, security |
| Process management | Shell script with & | Docker restart policy | Docker handles crash detection, restart, logging |
| Health monitoring | Complex app-level checks | Simple HTTP endpoint + Docker healthcheck | Docker native, visible in `docker compose ps` |

## Common Pitfalls

### Pitfall 1: Alpine wget vs curl
**What goes wrong:** Health check uses `curl` but Alpine doesn't include it
**Why it happens:** Developers test on Ubuntu/Debian where curl is standard
**How to avoid:** Use `wget --no-verbose --tries=1 --spider` which is included in Alpine
**Warning signs:** Health check fails immediately, container stays "starting"

### Pitfall 2: Static path resolution
**What goes wrong:** `express.static('./public')` resolves relative to CWD, not to server.js location
**Why it happens:** Confusion between `__dirname` and `process.cwd()`
**How to avoid:** Always use `path.join(__dirname, '../public')` for predictable resolution
**Warning signs:** 404 on all static assets, Express returns empty responses

### Pitfall 3: SPA client-side routing
**What goes wrong:** Direct URL access to React routes returns 404
**Why it happens:** Express doesn't know about React Router paths
**How to avoid:** Add a catch-all route AFTER API routes: `app.get('*', (req, res) => res.sendFile(path.join(publicPath, 'index.html')))`
**Warning signs:** Refresh on non-root page returns 404. Note: current app may not use client-side routing, but adding the catch-all is defensive and harmless.

### Pitfall 4: Compose version field deprecation
**What goes wrong:** `version: '3.8'` at top of docker-compose.yml triggers warnings in Compose v2
**Why it happens:** Docker Compose v2 ignores the version field
**How to avoid:** Remove the `version` line entirely. Compose v2 infers the format.
**Warning signs:** Warning message on `docker compose up` (non-breaking but noisy)

### Pitfall 5: Docker build context too large
**What goes wrong:** Build sends node_modules to daemon, takes forever
**Why it happens:** Missing or inadequate .dockerignore
**How to avoid:** .dockerignore already exists and excludes node_modules -- keep it

## Code Examples

### Health Check Route (server.js addition)
```javascript
// Add after existing middleware, before Socket.io handlers
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

### Static Serving (server.js addition)
```javascript
// Serve React build in production
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// SPA catch-all (after all other routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});
```

### Verification Commands
```bash
# Build and start
docker compose up --build -d

# Check health status
docker compose ps  # should show "healthy"

# Test HTTP response
curl http://localhost:3923/health  # {"status":"ok"}
curl -s http://localhost:3923/ | head -5  # Should return HTML

# Check logs
docker compose logs bingo

# Stop
docker compose down
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `version: '3.8'` in compose | No version field (Compose v2) | Cleaner, no warnings |
| Node 18 | Node 20 LTS | Active LTS until April 2026 |
| `npm install` in Docker | `npm ci` with lockfile | User chose `npm install` (no lockfiles) |
| Multi-process container | Single process | Proper signal handling, simpler |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (docker compose + curl) |
| Config file | docker-compose.yml |
| Quick run command | `docker compose up --build -d && sleep 5 && curl -f http://localhost:3923/health` |
| Full suite command | `docker compose up --build -d && sleep 10 && curl -f http://localhost:3923/health && docker compose ps --format json` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCK-01 | Single Express serves React + Socket.io | smoke | `curl -f http://localhost:3923/ && curl -f http://localhost:3923/health` | N/A (infra) |
| DOCK-02 | Node 20 base image | smoke | `docker compose exec bingo node --version` (expect v20.x) | N/A (infra) |
| DOCK-03 | Port 3923 externally | smoke | `curl -f http://localhost:3923/health` | N/A (infra) |
| DOCK-04 | Health check passes | smoke | `docker compose ps` (shows "healthy") | N/A (infra) |
| DOCK-05 | Reproducible build | manual | Rebuild twice, compare behavior | N/A (infra) |

### Sampling Rate
- **Per task commit:** `docker compose up --build -d && sleep 5 && curl -f http://localhost:3923/health`
- **Per wave merge:** Full verification with all smoke tests above
- **Phase gate:** All 4 smoke tests pass, `docker compose ps` shows healthy

### Wave 0 Gaps
None -- this is infrastructure testing via Docker commands, no test framework needed for this phase.

## Open Questions

1. **Compose v1 vs v2 on target server**
   - What we know: Server is a home lab that auto-boots 05:00, shuts down 22:00 CET
   - What's unclear: Whether `docker compose` (v2) or `docker-compose` (v1) is installed
   - Recommendation: Write compose file compatible with both (remove `version` field, avoid v2-only features). The `version` field removal is compatible with both v1 and v2.

2. **React build output location**
   - What we know: CRA `npm run build` outputs to `client/build/` directory
   - Current Dockerfile copies to `/app/public`: `COPY --from=builder /app/client/build ./public`
   - This is correct -- server.js will serve from `../public` relative to its location in `/app/server/`
   - No action needed, just confirming the path chain works.

## Sources

### Primary (HIGH confidence)
- Existing project files: Dockerfile, docker-compose.yml, server/server.js, package.json files
- CONTEXT.md user decisions (locked choices)

### Secondary (MEDIUM confidence)
- Docker official documentation for healthcheck syntax
- Node.js LTS schedule (Node 20 LTS until April 2026)
- Alpine Linux default packages (wget included, curl not included)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, just reorganizing
- Architecture: HIGH - well-understood patterns (express.static, single-process Docker)
- Pitfalls: HIGH - common Docker/Node patterns, well-documented

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable infrastructure, nothing fast-moving)
