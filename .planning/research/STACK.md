# Technology Stack

**Project:** Schweisstal Bingo - Deployment, Testing, and Infrastructure
**Researched:** 2026-03-05

## Context

This covers the NEW tooling needed for the upcoming milestone: CI/CD pipeline, testing, Docker improvements, and Cloudflare Tunnel. The existing React 18 + Express 4.18 + Socket.io 4.5.4 stack is kept as-is.

## Recommended Stack

### Testing - Server Side

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^4.0 | Test runner for server-side tests | Official Socket.io docs list Vitest as a first-class option. 4x faster cold starts than Jest. ESM-native so no transform hassles with modern Node. Since the server is plain Node/Express (no react-scripts), Vitest is the clear winner. |
| socket.io-client | ^4.5.4 | Test client for Socket.io integration tests | Official Socket.io testing pattern: spin up real server, connect real client, assert events. Already a project dependency on the client side. |
| supertest | ^7.0 | HTTP endpoint testing for Express routes | Industry standard for Express route testing. Binds to ephemeral port, no port conflicts in CI. |

**Confidence:** HIGH - Vitest recommended in official Socket.io docs, supertest is the undisputed Express testing standard.

### Testing - Client Side

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Jest (via react-scripts) | (bundled) | Client-side unit tests | The project uses Create React App with react-scripts 5.0.1, which bundles Jest. Migrating CRA to Vite is out of scope for this milestone. Use what CRA gives you. |
| @testing-library/react | ^16.0 | React component testing | Standard for CRA projects. Tests user behavior, not implementation details. |
| @testing-library/jest-dom | ^6.0 | DOM assertion matchers | Adds toBeInTheDocument(), toHaveTextContent() etc. |

**Confidence:** HIGH - CRA bundles Jest; fighting it would be wasted effort for a milestone focused on deployment.

### Testing Strategy Note

Use TWO test runners: Vitest for server (`server/` directory), Jest via react-scripts for client (`client/` directory). This avoids CRA migration complexity while giving the server modern tooling. Each has its own config and npm scripts.

### CI/CD Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | CI/CD orchestration | Already using self-hosted runner at `/home/lab/actions-runner/`. Existing pattern from portfolio project. |
| actions/checkout | v4 | Repository checkout | Standard, maintained by GitHub. |
| actions/setup-node | v4 | Node.js environment | Ensures consistent Node version in CI. |
| docker/build-push-action | v6 | Docker image build | Not needed - building directly on self-hosted runner with docker compose is simpler for single-server deployment. |

**Confidence:** HIGH - mirrors existing portfolio CI pattern described in PROJECT.md.

### CI/CD Workflow Structure

| Step | Tool | Purpose |
|------|------|---------|
| Cancel previous | `styfle/cancel-workflow-action@0.12` | Prevent redundant builds on rapid pushes |
| Version bump | `npm version patch` (or conventional-commits action) | Increment version in package.json |
| Install + Test | `npm ci && npm test` | Run both server and client tests |
| Docker build + deploy | `docker compose up -d --build` | Build and restart containers on the server |
| Discord notify | Webhook POST | Notify deployment status (matches portfolio pattern) |

**Confidence:** HIGH - follows the exact CI pattern documented in PROJECT.md from the portfolio project.

### Version Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| npm version | (built-in) | Semver version bumping | Simple `npm version patch/minor/major` is sufficient for a private app. No npm publishing needed, so semantic-release is overkill. |
| Conventional Commits | N/A (convention) | Commit message format | Use `feat:`, `fix:`, `chore:` prefixes for clarity, but automated version detection is unnecessary for a private bingo game. |

**Confidence:** HIGH - semantic-release is designed for published packages. A simple `npm version patch` in CI is appropriate here.

### Docker Improvements

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose | v2 (CLI plugin) | Container orchestration | Already in use. Needs port mapping fix (currently 3000/3001, should be 3923 per PROJECT.md). |
| Node 20 Alpine | 20-alpine | Base Docker image | Current Dockerfile uses node:18-alpine. Node 18 EOL was April 2025. Node 20 is current LTS (EOL April 2026). Node 22 LTS available but 20 is safer for stability. |
| serve | ^14.0 | Static file serving | Replace http-server in Dockerfile. Better defaults, actively maintained. Alternative: just serve from Express (simpler, one process). |

**Confidence:** MEDIUM on Node version (need to verify Node 20 vs 22 LTS status). HIGH on Docker Compose.

### Dockerfile Architecture Recommendation

The current Dockerfile runs TWO processes (`node server.js & http-server ./public`). This is an anti-pattern. Instead, serve the React build from Express directly using `express.static()`. Single process, simpler health checks, no process management needed.

### Cloudflare Tunnel

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| cloudflared | latest | Tunnel daemon | Already running on the home lab server. Just needs a new ingress rule added. |

**Confidence:** HIGH - existing infrastructure, just configuration.

### Cloudflare Tunnel Configuration

The server already runs cloudflared with existing tunnels:
- `gregor.922-studio.com` -> `:3922`
- `922-studio.com` -> `:8010`

Add one ingress rule to the existing `config.yml`:

```yaml
ingress:
  # ... existing rules ...
  - hostname: bingo.922-studio.com
    service: http://localhost:3923
  # catch-all must remain last
  - service: http_status:404
```

After editing, restart cloudflared: `sudo systemctl restart cloudflared`

Also add a CNAME DNS record in Cloudflare dashboard pointing `bingo.922-studio.com` to the tunnel UUID (or it may already be set up as a wildcard).

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Server test runner | Vitest | Jest standalone | Jest requires more config for ESM, slower. Socket.io docs recommend Vitest equally. |
| Client test runner | Jest (via CRA) | Vitest | Would require CRA-to-Vite migration, out of scope for this milestone. |
| Version management | npm version | semantic-release | Overkill for private app with no npm publishing. Adds complexity (plugins, tokens, config). |
| Static serving in Docker | Express.static() | http-server / serve / nginx | One fewer process. Express already runs. No need for a separate static server. |
| Node base image | 20-alpine | 22-alpine | Node 22 LTS is newer but Node 20 has longer track record. Either works. |
| Deployment | docker compose on runner | Container registry + pull | Single server, no registry needed. Build on the machine that runs it. |

## Installation

### Server dev dependencies
```bash
cd server
npm install -D vitest supertest
```

### Client dev dependencies
```bash
cd client
npm install -D @testing-library/react @testing-library/jest-dom
```

### No new production dependencies needed

The testing and CI/CD tooling is all dev-side. No new runtime dependencies.

## Key Configuration Files to Create

| File | Purpose |
|------|---------|
| `server/vitest.config.js` | Vitest config for server tests |
| `server/__tests__/` | Server test directory |
| `client/src/setupTests.js` | Jest setup for React Testing Library |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
| `docker-compose.yml` | Updated with correct port (3923) |
| `Dockerfile` | Updated Node version, single-process |

## Sources

- [Socket.io Official Testing Docs](https://socket.io/docs/v4/testing/) - Vitest/Jest patterns
- [Vitest npm](https://www.npmjs.com/package/vitest) - v4.0.18 current
- [Cloudflare Tunnel Configuration](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/) - Ingress rules
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/actions/hosting-your-own-runners) - Runner docs
- [supertest npm](https://www.npmjs.com/package/supertest) - Express testing
- [Many services, one cloudflared](https://blog.cloudflare.com/many-services-one-cloudflared/) - Multi-service tunnel config
