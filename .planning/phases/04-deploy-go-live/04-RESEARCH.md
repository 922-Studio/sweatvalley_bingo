# Phase 4: Deploy & Go Live - Research

**Researched:** 2026-03-05
**Domain:** CI/CD pipeline (GitHub Actions), Cloudflare Tunnel, Docker Compose deployment
**Confidence:** HIGH

## Summary

Phase 4 covers the full deployment pipeline: GitHub Actions CI/CD on a self-hosted runner, Cloudflare Tunnel for public access, and production-hardened Socket.io configuration. The project already has a working Docker Compose setup (Phase 1) and passing tests (Phase 3), so this phase wires them together into an automated deploy-on-push workflow.

The server already runs a self-hosted GitHub Actions runner at `/home/lab/actions-runner/`. Cloudflare Tunnel (`cloudflared`) is already running on the server, mapping `gregor.922-studio.com` to `:3922` and `922-studio.com` to `:8010`. Adding `bingo.922-studio.com` requires: a new ingress rule in the cloudflared config, a CNAME DNS record, and a `cloudflared` service restart.

**Primary recommendation:** Keep the workflow simple -- single-file GitHub Actions workflow with test, version-bump, docker-compose-deploy, and Discord-notify steps. Avoid over-engineering with reusable workflows for a single-service app.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub repo created under personal account | Manual step, private repo, self-hosted runner label |
| CICD-02 | GitHub Actions workflow runs tests on push to main | Workflow with `cd server && npm test` and `cd client && npx react-scripts test --watchAll=false` |
| CICD-03 | Version bump via conventional commits | `phips28/gh-action-bump-version` action bumps package.json based on commit message |
| CICD-04 | Deploy via docker compose on self-hosted runner | `docker compose up -d --build` on runner, runs-on: self-hosted |
| CICD-05 | Discord notification on deploy success/failure | `sarisia/actions-status-discord@v1` with webhook secret |
| CICD-06 | Concurrency group cancels previous in-progress runs | `concurrency: { group: deploy-${{ github.ref }}, cancel-in-progress: true }` |
| ACCS-01 | Cloudflare Tunnel ingress rule for bingo.922-studio.com -> localhost:3923 | Add hostname entry to cloudflared config.yml, restart service |
| ACCS-02 | CORS locked to production domain + localhost dev | Server cors origin array: `["https://bingo.922-studio.com", "http://localhost:3000"]` |
| ACCS-03 | Socket.io aggressive ping (10s interval, 5s timeout) | Server-side `pingInterval: 10000, pingTimeout: 5000` in io options |
| ACCS-04 | Socket.io WebSocket-only transport (no polling) | Server: `transports: ['websocket']`, Client: `transports: ['websocket']` |
| ACCS-05 | CNAME record for bingo.922-studio.com in Cloudflare DNS | Proxied CNAME pointing to tunnel UUID.cfargotunnel.com |
| DOCS-01 | HomeStructure docs with Cloudflare Tunnel guide | Markdown guide documenting ingress rule + CNAME pattern for adding new subdomains |
</phase_requirements>

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | v2 (YAML) | CI/CD pipeline | Already used by 922-Studio org, runner already on server |
| Docker Compose | v2 | Container orchestration | Already set up in Phase 1, `docker compose` CLI |
| cloudflared | latest | Tunnel to expose local services | Already running on server, handles SSL termination |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `phips28/gh-action-bump-version` | `@master` | Auto version bump from commit messages | On every push to main |
| `sarisia/actions-status-discord` | `@v1` | Discord deploy notifications | After deploy step (success or failure) |
| `actions/checkout` | `@v4` | Checkout repo on runner | First step of every workflow |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `phips28/gh-action-bump-version` | `semantic-release` | Semantic-release is heavier, creates GitHub releases, overkill for this app |
| `sarisia/actions-status-discord` | curl to Discord webhook | Action provides better formatting, status-aware colors |
| Self-hosted runner | GitHub-hosted runner | Server needs direct Docker access; self-hosted runner IS the deploy target |

## Architecture Patterns

### GitHub Actions Workflow Structure

```yaml
name: Deploy Schweisstal Bingo

on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted]
    steps:
      # 1. Checkout
      # 2. Run server tests
      # 3. Run client tests
      # 4. Version bump
      # 5. Docker compose build + deploy
      # 6. Health check
      # 7. Discord notification (always runs)
```

**Key pattern:** Single job, not multi-job. The self-hosted runner IS the deploy server, so checkout + test + deploy all happen on the same machine. No artifacts to transfer.

### Cloudflare Tunnel Ingress Pattern

```yaml
tunnel: <UUID>
credentials-file: /home/lab/.cloudflared/<UUID>.json

ingress:
  - hostname: 922-studio.com
    service: http://localhost:8010
  - hostname: gregor.922-studio.com
    service: http://localhost:3922
  - hostname: bingo.922-studio.com      # NEW
    service: http://localhost:3923        # NEW
  - service: http_status:404             # catch-all (required)
```

### Socket.io Production Configuration

**Server-side** (in `server.js`):
```javascript
const io = socketIO(httpServer, {
  cors: {
    origin: [
      "https://bingo.922-studio.com",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"]
  },
  transports: ['websocket'],
  pingInterval: 10000,
  pingTimeout: 5000
});
```

**Client-side** (in `App.js`):
```javascript
const socketURL = process.env.NODE_ENV === 'production'
  ? window.location.origin   // same origin, no port needed
  : 'http://localhost:3001';

const newSocket = io(socketURL, {
  reconnectionDelay: 1000,
  reconnection: true,
  reconnectionAttempts: 10,
  transports: ['websocket'],  // WebSocket only, no polling
});
```

### CORS Middleware

```javascript
app.use(cors({
  origin: [
    "https://bingo.922-studio.com",
    "http://localhost:3000"
  ]
}));
```

Replace the current `cors()` (allows all origins) with explicit origin list.

### Anti-Patterns to Avoid

- **Multi-job workflow on self-hosted runner:** No need -- single machine is both test runner and deploy target. Multiple jobs would checkout separately and waste time.
- **Docker Hub / GHCR push:** Explicitly out of scope. Build locally on the server.
- **`docker compose down && docker compose up`:** Use `docker compose up -d --build` instead -- it rebuilds and restarts in one command with minimal downtime.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version bumping | Custom bash script parsing commits | `phips28/gh-action-bump-version` | Handles edge cases, tags, commit push |
| Discord notifications | curl with JSON payload | `sarisia/actions-status-discord@v1` | Auto-detects status, provides embeds with repo/commit links |
| SSL termination | Nginx/Caddy reverse proxy | Cloudflare Tunnel | Already running, handles certs automatically |
| Concurrency control | Lock files or mutex | GitHub Actions `concurrency` key | Built-in, battle-tested |

## Common Pitfalls

### Pitfall 1: Self-hosted runner permissions for Docker
**What goes wrong:** Runner user can't execute `docker compose` commands.
**Why it happens:** The runner process user isn't in the `docker` group.
**How to avoid:** Verify runner user is in docker group: `groups lab` should show `docker`. The existing runner at `/home/lab/actions-runner/` likely already has this since it deploys the portfolio.
**Warning signs:** "permission denied" errors in workflow logs.

### Pitfall 2: Client Socket.io URL in production
**What goes wrong:** Client tries to connect to `window.location.hostname:3001` which doesn't work through Cloudflare Tunnel (Tunnel routes to port 3923 on host, which maps to 3001 internally).
**Why it happens:** Current code uses `${window.location.protocol}//${window.location.hostname}:3001` in production.
**How to avoid:** In production, use `window.location.origin` (no port) since Express serves both static files AND Socket.io on the same origin. Cloudflare Tunnel handles the routing.
**Warning signs:** WebSocket connection errors in browser console.

### Pitfall 3: Cloudflare WebSocket idle timeout
**What goes wrong:** WebSocket connections drop after ~100 seconds of inactivity.
**Why it happens:** Cloudflare's proxy has a 100-second idle timeout for non-Enterprise plans.
**How to avoid:** Set Socket.io `pingInterval: 10000` (10s) and `pingTimeout: 5000` (5s). This sends a ping every 10 seconds, well within the 100-second window.
**Warning signs:** Players randomly disconnecting during quiet game moments.

### Pitfall 4: Version bump creating infinite loop
**What goes wrong:** Version bump commits trigger the workflow again, creating an infinite loop.
**Why it happens:** The bump action pushes a commit to main, which triggers `on: push`.
**How to avoid:** `phips28/gh-action-bump-version` uses `[skip ci]` in its commit messages by default, which GitHub Actions respects. Verify this behavior.
**Warning signs:** Rapid successive workflow runs.

### Pitfall 5: cloudflared config file location
**What goes wrong:** Editing the wrong config file or not finding it.
**Why it happens:** cloudflared config can be at `~/.cloudflared/config.yml`, `/etc/cloudflared/config.yml`, or a custom path.
**How to avoid:** Check where the running cloudflared service points to: `systemctl cat cloudflared` or `ps aux | grep cloudflared` to find the `--config` flag.
**Warning signs:** Changes don't take effect after restart.

### Pitfall 6: CNAME record must be proxied
**What goes wrong:** Cloudflare Tunnel doesn't receive traffic for the subdomain.
**Why it happens:** CNAME record set to DNS-only (grey cloud) instead of proxied (orange cloud).
**How to avoid:** CNAME must be proxied (orange cloud). Target is `<TUNNEL-UUID>.cfargotunnel.com`.
**Warning signs:** DNS resolves but connection times out or shows origin server errors.

## Code Examples

### Complete GitHub Actions Workflow

```yaml
name: Deploy Schweisstal Bingo

on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install server dependencies
        run: cd server && npm install

      - name: Run server tests
        run: cd server && npm test

      - name: Install client dependencies
        run: cd client && npm install

      - name: Run client tests
        run: cd client && npx react-scripts test --watchAll=false
        env:
          CI: true

      - name: Version bump
        uses: phips28/gh-action-bump-version@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          minor-wording: 'feat'
          major-wording: 'BREAKING CHANGE'
          patch-wording: 'fix,chore,refactor,docs,style,perf'

      - name: Deploy
        run: docker compose up -d --build

      - name: Health check
        run: |
          sleep 10
          curl -f http://localhost:3923/health || exit 1

      - name: Discord notification
        if: always()
        uses: sarisia/actions-status-discord@v1
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
          title: "Schweisstal Bingo Deploy"
          description: "Deployment to bingo.922-studio.com"
```

### Cloudflare Tunnel Ingress Addition

```yaml
# Add to existing cloudflared config.yml
# Location: check with `systemctl cat cloudflared` or `ps aux | grep cloudflared`
ingress:
  # ... existing rules ...
  - hostname: bingo.922-studio.com
    service: http://localhost:3923
  - service: http_status:404  # catch-all must be last
```

After editing:
```bash
# Validate config
cloudflared tunnel ingress validate

# Restart to apply
sudo systemctl restart cloudflared
```

### CNAME DNS Record

```
Type: CNAME
Name: bingo
Target: <TUNNEL-UUID>.cfargotunnel.com
Proxy status: Proxied (orange cloud)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `docker-compose` (v1 CLI) | `docker compose` (v2 CLI, plugin) | 2023 | Use `docker compose` (no hyphen) |
| Socket.io polling+websocket | WebSocket-only transport | Always available | Better performance, simpler debugging |
| `cors: { origin: "*" }` | Explicit origin whitelist | Security best practice | Prevents cross-origin attacks |

**Deprecated/outdated:**
- `docker-compose` (hyphenated): v1 standalone binary is deprecated. Use `docker compose` (v2 plugin).
- `standard-version`: Deprecated in favor of `release-please` or similar. But `phips28/gh-action-bump-version` is simpler and sufficient here.

## Open Questions

1. **Exact cloudflared config file location on server**
   - What we know: cloudflared is running, serves gregor.922-studio.com and 922-studio.com
   - What's unclear: Config at `~/.cloudflared/config.yml` or `/etc/cloudflared/config.yml`?
   - Recommendation: Check with `systemctl cat cloudflared` during implementation. This is a runtime discovery, not a blocker.

2. **Whether CNAME for bingo.922-studio.com already exists**
   - What we know: Other subdomains (gregor, root) are configured
   - What's unclear: Has the bingo CNAME been pre-created?
   - Recommendation: Check Cloudflare dashboard or `dig bingo.922-studio.com` during implementation. Create if missing.

3. **Docker Compose v1 vs v2 CLI on server**
   - What we know: Server runs Ubuntu, has Docker installed
   - What's unclear: Is `docker compose` (v2 plugin) available or only `docker-compose` (v1)?
   - Recommendation: Try `docker compose version` first. If only v1, use `docker-compose`. The workflow YAML can use a variable.

4. **GitHub repo name**
   - What we know: Private repo under personal account
   - What's unclear: Exact repo name (e.g., `schweisstal-bingo` or `Schweisstal_bingo`)
   - Recommendation: User creates repo manually (CICD-01), workflow references it.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (server), Jest 27 via react-scripts 5 (client) |
| Config file | server: inline in package.json, client: react-scripts built-in |
| Quick run command | `cd server && npx vitest run --reporter=verbose` |
| Full suite command | `cd server && npm test && cd ../client && npx react-scripts test --watchAll=false` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | GitHub repo created | manual-only | N/A (manual setup) | N/A |
| CICD-02 | Tests run on push to main | integration | Push to main, check Actions tab | N/A (workflow file) |
| CICD-03 | Version bump via conventional commits | integration | Push feat/fix commit, check version | N/A (workflow behavior) |
| CICD-04 | Deploy via docker compose | smoke | `curl -f http://localhost:3923/health` | N/A |
| CICD-05 | Discord notification | manual-only | Check Discord channel after deploy | N/A |
| CICD-06 | Concurrency cancels previous runs | manual-only | Push twice rapidly, check Actions | N/A |
| ACCS-01 | Tunnel routes bingo subdomain | smoke | `curl -f https://bingo.922-studio.com/health` | N/A |
| ACCS-02 | CORS locked to production domain | unit | Test CORS headers with curl | N/A |
| ACCS-03 | Aggressive ping settings | unit | Verify io options in server.js | N/A |
| ACCS-04 | WebSocket-only transport | unit | Verify transports config in server.js + App.js | N/A |
| ACCS-05 | CNAME record configured | manual-only | `dig bingo.922-studio.com` | N/A |
| DOCS-01 | HomeStructure docs updated | manual-only | File exists check | N/A |

### Sampling Rate

- **Per task commit:** `cd server && npm test`
- **Per wave merge:** Full suite: server + client tests
- **Phase gate:** `curl -f https://bingo.922-studio.com/health` returns 200

### Wave 0 Gaps

None -- this phase is primarily configuration (workflow YAML, server config changes, DNS setup) rather than new application code. Existing test infrastructure from Phase 3 covers the test-running requirement (CICD-02).

## Sources

### Primary (HIGH confidence)
- Cloudflare Tunnel configuration docs - ingress rule format, catch-all requirement
- GitHub Actions docs - concurrency groups, self-hosted runner labels
- Socket.io v4 docs - pingInterval, pingTimeout, transports options
- Project codebase - existing server.js, docker-compose.yml, package.json files

### Secondary (MEDIUM confidence)
- [phips28/gh-action-bump-version](https://github.com/phips28/gh-action-bump-version) - version bump action usage, inputs, [skip ci] behavior
- [sarisia/actions-status-discord](https://github.com/sarisia/actions-status-discord) - Discord notification action usage
- [Cloudflare WebSocket docs](https://developers.cloudflare.com/network/websockets/) - timeout guidance
- [Cloudflare Tunnel config](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/) - YAML format

### Tertiary (LOW confidence)
- Cloudflare community forums - 100s idle timeout for non-Enterprise (multiple sources agree, but not in official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - well-known tools, existing server infrastructure documented in PROJECT.md
- Architecture: HIGH - single-service deployment is straightforward, patterns are standard
- Pitfalls: HIGH - WebSocket+Cloudflare issues well-documented in community forums
- Cloudflared config location: LOW - runtime discovery needed on actual server

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, tools are mature)
