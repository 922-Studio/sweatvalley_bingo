# Architecture Patterns

**Domain:** Deployment and testing infrastructure for Socket.io bingo game
**Researched:** 2026-03-05

## Recommended Architecture

### Single-Container, Single-Process Docker Setup

```
[Cloudflare Tunnel] --> [Docker Container :3923]
                              |
                         [Express Server]
                          /            \
              [Socket.io WSS]    [express.static('/public')]
                    |                    |
              [Game Logic]        [React SPA Build]
```

### Current vs Recommended Dockerfile

**Current (problematic):**
- Two processes: `node server.js & http-server ./public`
- Two exposed ports: 3000 (static) + 3001 (API/WS)
- Shell `&` means no proper process management
- If either process crashes, container stays "healthy"

**Recommended:**
- Single process: Express serves both API/WebSocket AND static files
- One exposed port: 3923
- Express handles `express.static('./public')` for the React build
- Container exits cleanly on crash, Docker restarts it

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Express server | HTTP API + static file serving + Socket.io host | Clients via HTTP/WS |
| Socket.io | Real-time game events (join, mark, score, win) | Browser clients |
| React SPA | Game UI, served as static files | Express (static), Socket.io (WS) |
| Docker Compose | Container lifecycle, port mapping, volume mounts | Docker daemon |
| GitHub Actions | Build, test, deploy orchestration | Self-hosted runner on home-lab |
| cloudflared | Tunnel public traffic to localhost | Cloudflare edge, Express container |

### Data Flow

**Player Request Flow:**
```
Browser --> bingo.922-studio.com (Cloudflare DNS)
  --> Cloudflare edge (SSL termination)
  --> cloudflared tunnel (on home-lab)
  --> localhost:3923 (Docker port mapping)
  --> Express container
     --> GET / --> serve React SPA
     --> WS upgrade --> Socket.io game events
```

**Deployment Flow:**
```
Developer pushes to main
  --> GitHub webhook triggers Actions
  --> Self-hosted runner picks up job
  --> Runner: npm ci && npm test (both client + server)
  --> Runner: npm version patch (auto-commit + tag)
  --> Runner: docker compose build --no-cache
  --> Runner: docker compose up -d
  --> Runner: curl health check on localhost:3923
  --> Runner: Discord webhook notification (success/fail)
```

## Testing Architecture

### Two Test Runners, Separated by Directory

| Runner | Scope | Config | Why |
|--------|-------|--------|-----|
| **Vitest** | Server tests (`server/__tests__/`) | `server/vitest.config.js` | ESM-native, 4x faster than Jest, officially recommended by Socket.io docs. Server is plain Node -- no CRA constraints. |
| **Jest** (via react-scripts) | Client tests (`client/src/__tests__/`) | Bundled with CRA | CRA bundles Jest. Fighting it (migrating to Vite+Vitest) is out of scope. Use what CRA gives you. |

### Test Categories

**Server Tests** (`server/__tests__/`):

1. **Unit: Game Logic** -- Pure functions, no Socket.io needed
   - `generateGrid()` -- correct size, correct difficulty distribution
   - `checkForLines()` -- row/column/diagonal detection
   - `createPlayerGrid()` -- proper 2D array creation

2. **Integration: Socket.io Events** -- Real server + client sockets
   - `create-game` -- returns gameId, adds player
   - `join-game` -- player joins, all players notified
   - `start-game` -- grids generated, game status changes
   - `mark-word` -- score updates broadcast
   - `end-round` -- scores calculated, round advances
   - `disconnect` -- player removed, game cleaned up

**Client Tests** (`client/src/__tests__/`):

3. **Component Tests** -- Render and interaction
   - Lobby view: create/join game forms
   - Game grid: clicking cells toggles marks
   - Scoreboard: displays player scores

### Socket.io Test Pattern (Server, Vitest)

Based on [official Socket.io testing docs](https://socket.io/docs/v4/testing/):

```javascript
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Game Events', () => {
  let ioServer, httpServer, clientSocket;

  beforeAll(() => new Promise((resolve) => {
    httpServer = createServer();
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', resolve);
    });
    // Register event handlers on ioServer
  }));

  afterAll(() => {
    ioServer.close();
    clientSocket.disconnect();
  });

  it('should create a game and return gameId', () => new Promise((resolve) => {
    clientSocket.emit('create-game', { hostName: 'TestHost' });
    clientSocket.on('game-created', (data) => {
      expect(data.gameId).toBeDefined();
      resolve();
    });
  }));
});
```

### Server Refactoring for Testability

**Key prerequisite:** Extract pure game logic from `server.js` into a separate module so it can be unit-tested without Socket.io:

```
server/
  server.js        Entry point: creates Express app, Socket.io, wires events
  game.js          Pure game logic: generateGrid, checkForLines, createPlayerGrid
  __tests__/
    game.test.js   Unit tests for pure game logic (fast, no network)
    events.test.js Integration tests for Socket.io events (real server + client)
  vitest.config.js Vitest configuration
  package.json     "test": "vitest run"
```

## CI/CD Pipeline Architecture

### Workflow Structure

Single workflow file (`.github/workflows/deploy.yml`) matching the portfolio pattern:

```yaml
name: Deploy Bingo
on:
  push:
    branches: [main]

concurrency:
  group: deploy
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: [self-hosted]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install server deps
        run: cd server && npm ci

      - name: Install client deps
        run: cd client && npm ci

      - name: Test server
        run: cd server && npm test

      - name: Test client
        run: cd client && npm test -- --watchAll=false

      - name: Bump version
        run: |
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          npm version patch -m "v%s"
          git push --follow-tags

      - name: Deploy
        run: |
          docker compose build --no-cache
          docker compose up -d
          sleep 3
          curl -f http://localhost:3923/health || exit 1

      - name: Notify Discord
        if: always()
        run: |
          STATUS="${{ job.status }}"
          curl -H "Content-Type: application/json" \
            -d "{\"content\": \"Bingo deploy: ${STATUS}\"}" \
            "${{ secrets.DISCORD_WEBHOOK_URL }}"
```

### Why This Structure

- **Single job, sequential steps:** The self-hosted runner IS the deployment target. No SSH, no remote deployment.
- **concurrency group:** Prevents overlapping deploys on rapid pushes.
- **Health check after deploy:** `curl -f` validates the container is actually serving.
- **cancel-in-progress:** If the server is offline (22:00-05:00 schedule), only the latest push deploys when it comes back.

## Cloudflare Tunnel Integration

The tunnel is already running on the server as a systemd service. Adding a new route:

```yaml
# ~/.cloudflared/config.yml (on home-lab)
ingress:
  - hostname: gregor.922-studio.com
    service: http://localhost:3922
  - hostname: 922-studio.com
    service: http://localhost:8010
  - hostname: bingo.922-studio.com      # NEW
    service: http://localhost:3923       # NEW
  - service: http_status:404
```

Then: add CNAME DNS record in Cloudflare dashboard, restart cloudflared: `sudo systemctl restart cloudflared`.

**No cloudflared in Docker Compose.** It already runs as a host-level system service.

## Patterns to Follow

### Pattern 1: Extract Pure Logic for Unit Testing
**What:** Move pure functions out of server.js into importable modules.
**When:** Before writing any tests.
**Why:** Functions like `generateGrid` and `checkForLines` have no Socket.io dependencies. Testing them should not require network setup.

### Pattern 2: Health Check Endpoint
**What:** Add `GET /health` to Express returning 200 with status JSON.
**When:** During Docker/CI setup.
**Why:** CI deploy verification, Docker healthcheck, Cloudflare origin monitoring.

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', games: games.size, uptime: process.uptime() });
});
```

### Pattern 3: Environment-Driven Port
**What:** Read port from `PORT` env var with fallback.
**When:** When updating docker-compose.yml.

```javascript
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0');
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Multiple Processes in One Container
**What:** Running `http-server & node server.js` in a single container.
**Why bad:** Silent crashes, no signal propagation, interleaved logs.
**Instead:** Single Express process serves static files and WebSocket API.

### Anti-Pattern 2: cloudflared in Docker Compose
**What:** Adding a cloudflared container alongside the app.
**Why bad:** Tunnel already runs as systemd service. Second instance creates conflicts.
**Instead:** Add ingress rule to existing host-level config.

### Anti-Pattern 3: SSH Deployment from CI
**What:** CI SSHes into the server to run deploy commands.
**Why bad:** Runner IS on the server. SSH to localhost is pointless.
**Instead:** Run `docker compose` directly in workflow steps.

### Anti-Pattern 4: Mocking Socket.io in Server Tests
**What:** Using vi.mock('socket.io') to test game logic.
**Why bad:** Mocks test your assumptions, not actual Socket.io behavior.
**Instead:** Real server + real client connections (Pattern in Testing section above).

## Scalability Considerations

Not a concern. Max ~30 concurrent players (one classroom). Single Node.js process handles this trivially.

| Concern | At 30 users (target) | Notes |
|---------|---------------------|-------|
| WebSocket connections | Trivial | Single process handles 10K+ |
| Memory (game state) | ~1 MB | Games are ephemeral |
| Static files | Express.static fine | Cloudflare CDN caches at edge |

## Sources

- [Socket.IO Official Testing Guide](https://socket.io/docs/v4/testing/) -- HIGH confidence
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.0.18 current
- [GitHub Actions Self-Hosted Runners](https://docs.github.com/actions/hosting-your-own-runners) -- HIGH confidence
- [Cloudflare Tunnel Configuration](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/) -- HIGH confidence
- [Many services, one cloudflared](https://blog.cloudflare.com/many-services-one-cloudflared/) -- HIGH confidence
