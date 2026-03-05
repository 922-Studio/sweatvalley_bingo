# Domain Pitfalls

**Domain:** CI/CD, testing, and deployment infrastructure for Socket.io bingo game
**Researched:** 2026-03-05

## Critical Pitfalls

Mistakes that cause broken deployments, unreachable services, or security incidents.

### Pitfall 1: Dual-Process Dockerfile with http-server

**What goes wrong:** The current Dockerfile runs two processes in a single container (`node server/server.js & http-server ./public -p 3000 -c-1`). When either process crashes, the container stays "healthy" because the shell PID is still alive. Logs are interleaved. Two ports must be exposed and routed.
**Why it happens:** Quick prototype setup -- separate frontend serving felt simpler than configuring Express.
**Consequences:** Silent server crashes, two ports to manage in Cloudflare Tunnel config, CORS issues between ports.
**Prevention:** Serve the React build directly from Express using `express.static()`. Single process, single port, single tunnel route. Remove `http-server` dependency.
**Detection:** Container running but WebSocket connections failing; frontend loads but Socket.io cannot connect.

### Pitfall 2: Cloudflare Tunnel WebSocket Timeout at ~100 Seconds

**What goes wrong:** Cloudflare enforces a ~100-second idle timeout on WebSocket connections. Socket.io's defaults (pingInterval: 25s, pingTimeout: 20s) total 45s -- normally fine. But Cloudflare edge restarts (frequent, unannounced) kill all active WebSocket connections.
**Why it happens:** Cloudflare's infrastructure terminates idle WebSocket connections. Edge server restarts close connections silently.
**Consequences:** Players randomly disconnect mid-game. Without reconnection handling, game state is lost.
**Prevention:**
1. Configure Socket.io with aggressive keepalive: `pingInterval: 10000, pingTimeout: 5000`
2. Implement client-side reconnection with state restoration
3. Store game state server-side keyed by player token for reconnect
**Detection:** Players report being "kicked" after 1-2 minutes of inactivity.

**Sources:**
- [Websockets disconnecting - Cloudflare Community](https://community.cloudflare.com/t/websockets-disconnecting-after-20s/661308)
- [cloudflared issue #1282](https://github.com/cloudflare/cloudflared/issues/1282)

### Pitfall 3: Socket.io Tests That Don't Clean Up

**What goes wrong:** Test creates Socket.io server + client connections but doesn't close them in afterAll/afterEach. Next test suite hangs or port is still bound.
**Why it happens:** Async cleanup is easy to forget. Socket.io connections don't close instantly.
**Consequences:** Test suite hangs, CI times out, flaky tests.
**Prevention:** Always close in afterAll: `ioServer.close(); clientSocket.disconnect();`. Use Vitest's `--forceExit` as safety net but fix root cause.
**Detection:** Tests pass locally but hang in CI. Or tests are flaky.

### Pitfall 4: Self-Hosted Runner Workspace Contamination

**What goes wrong:** The persistent self-hosted runner retains files between workflow runs. Old `node_modules`, build artifacts, or stale code from previous runs leak into new builds.
**Why it happens:** Self-hosted runners don't clean up workspaces by default (unlike GitHub-hosted VMs).
**Consequences:** Deploying stale code, `npm ci` fails with lockfile mismatches, mysterious build failures.
**Prevention:**
1. Always use `actions/checkout@v4` (cleans workspace by default)
2. Use `npm ci` (fails fast on lockfile mismatch)
3. Docker build context is always clean (preferred over native builds)
**Detection:** Build succeeds but deployed app has old behavior.

**Sources:**
- [GitHub Docs - Self-hosted runners](https://docs.github.com/actions/hosting-your-own-runners)

## Moderate Pitfalls

### Pitfall 5: Port Mismatch Between Docker Compose and Cloudflare Tunnel

**What goes wrong:** Docker Compose currently maps 3000/3001, but project specifies 3923. Cloudflare Tunnel routes to localhost:3923. If any of the three locations (Express listen, Docker port map, tunnel config) disagree, service is unreachable.
**Prevention:** Consolidate to single port. Use ENV var for Express port. Docker Compose maps to 3923 on host. Tunnel routes to localhost:3923.
**Detection:** `curl localhost:3923` returns nothing while `docker ps` shows container running.

### Pitfall 6: Server Schedule vs. Runner Availability

**What goes wrong:** Server shuts down at 22:00 CET, boots at 05:00. Pushes outside this window queue indefinitely (GitHub queues for 24h, then fails). Developer thinks deploy happened.
**Prevention:**
1. `concurrency` groups with `cancel-in-progress: true` so only latest push deploys
2. Discord notification on success/failure
3. Accept as known limitation -- document the 05:00-22:00 deploy window
**Detection:** Discord notification doesn't arrive. Actions tab shows "Queued".

### Pitfall 7: Node 18 EOL in Docker Image

**What goes wrong:** Dockerfile uses `node:18-alpine`. Node 18 reached EOL April 2025. No more security patches.
**Prevention:** Update to `node:20-alpine` (LTS until April 2026) or `node:22-alpine` (LTS until April 2027).
**Detection:** Security scanners flag the base image.

### Pitfall 8: react-scripts 5.0.1 OpenSSL Error with Node 20

**What goes wrong:** CRA's react-scripts 5.0.1 may throw `ERR_OSSL_EVP_UNSUPPORTED` during build on Node 18+.
**Prevention:** Set `NODE_OPTIONS=--openssl-legacy-provider` in the Docker build stage. Long-term fix is migrating off CRA (out of scope).
**Detection:** Docker build fails with OpenSSL error.

### Pitfall 9: CORS origin: "*" in Production

**What goes wrong:** Server uses `origin: "*"` for CORS. Behind Cloudflare Tunnel, polling transport fails intermittently. Credential-based features (reconnection tokens) cannot work.
**Prevention:** Set `origin` to `["https://bingo.922-studio.com"]`. Use env var for dev vs prod origins.
**Detection:** Browser console shows CORS errors on Socket.io polling requests.

**Sources:**
- [Handling CORS - Socket.IO docs](https://socket.io/docs/v3/handling-cors/)

### Pitfall 10: Cloudflare Tunnel Config Using ws:// Instead of http://

**What goes wrong:** Using `ws://` or `wss://` as the service URL causes Socket.io handshake (HTTP polling phase) to fail. Cloudflare handles WebSocket upgrade automatically.
**Prevention:** Always use `http://localhost:3923` in tunnel config. Never `ws://`.
**Detection:** Socket.io client stuck on "connecting". Browser shows 502 on polling requests.

## Minor Pitfalls

### Pitfall 11: Docker Build Cache with Missing Lock Files

**What goes wrong:** Current Dockerfile uses `COPY client/package-lock.json*` (glob = optional). Without lockfile, `npm install` produces non-reproducible builds.
**Prevention:** Commit both lockfiles. Use `npm ci` in Dockerfile (fails if lockfile missing). Remove the `*` glob.

### Pitfall 12: GitHub Actions Token Permissions for Version Bump

**What goes wrong:** Default `GITHUB_TOKEN` may lack write permissions for pushing version bump commits back to main.
**Prevention:** Use `permissions: contents: write` in the workflow. Or skip auto-committing version bumps.

### Pitfall 13: WebSockets Toggle in Cloudflare Dashboard

**What goes wrong:** WebSocket support must be explicitly enabled in Cloudflare Dashboard under Network settings for the domain. If disabled, all WebSocket upgrades are rejected at the edge.
**Prevention:** Verify: domain > Network > WebSockets = ON in Cloudflare Dashboard.
**Detection:** Socket.io never receives 101 upgrade response.

**Sources:**
- [WebSockets - Cloudflare Network settings](https://developers.cloudflare.com/network/websockets/)

### Pitfall 14: Two Test Runners Causing Confusion

**What goes wrong:** Project uses Vitest for server and Jest (via CRA) for client. Developers run wrong test command or get confused by different assertion APIs.
**Prevention:** Clear npm scripts: `test:server` (vitest), `test:client` (react-scripts test). Root `test` script runs both. Document in contributing guide.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Docker fix | Dual-process container, port mismatch, OpenSSL error | Single Express process, align ports, NODE_OPTIONS |
| Testing | Socket.io test cleanup / hanging, two runners | Close in afterAll, clear npm scripts |
| CI/CD | Workspace contamination, runner schedule, token perms | Clean checkout, concurrency groups, permissions |
| Cloudflare Tunnel | ws:// URL, WebSocket toggle, CORS | Use http://, check dashboard, explicit origins |

## Sources

- [Socket.IO Testing Docs](https://socket.io/docs/v4/testing/)
- [Cloudflare Tunnel Configuration](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- [WebSockets - Cloudflare Network settings](https://developers.cloudflare.com/network/websockets/)
- [Cloudflare Community - WebSocket disconnects](https://community.cloudflare.com/t/websockets-disconnecting-after-20s/661308)
- [GitHub Docs - Self-hosted runners](https://docs.github.com/actions/hosting-your-own-runners)
- [Handling CORS - Socket.IO docs](https://socket.io/docs/v3/handling-cors/)
