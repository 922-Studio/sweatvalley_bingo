# Phase 3: Test Suite - Research

**Researched:** 2026-03-05
**Domain:** Testing (Vitest for server, Jest/react-scripts for client, Socket.io integration)
**Confidence:** HIGH

## Summary

This phase adds automated tests to the Schweisstal Bingo app across three layers: server game logic (pure functions), server Socket.io event handlers, and client React components. The server uses Vitest; the client uses Jest via react-scripts (CRA's built-in test runner). One integration test must use real Socket.io client-server connections.

A critical prerequisite is **refactoring `server.js` to export testable functions**. Currently, `checkForLines` is defined INSIDE the `io.on('connection')` callback (line 207), making it impossible to import directly. The functions `generateGrid`, `createGame`, and `createPlayerGrid` are top-level but not exported (no `module.exports`). The server also hard-starts on `require()` (calls `loadWords()` and `server.listen()` at module level), which prevents clean test imports.

**Primary recommendation:** Extract pure logic into `server/gameLogic.js`, refactor `server.js` to conditionally start (or export a factory), then test logic with Vitest unit tests, Socket.io events with Vitest integration tests, and React components with Jest + React Testing Library.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Server game logic tested with Vitest (generateGrid, checkForLines, win condition) | Extract to `gameLogic.js`, test pure functions directly. See Architecture Patterns and Code Examples. |
| TEST-02 | Server Socket.io events tested with Vitest (create-game, join-game, mark-word, start-game) | Use official Socket.io testing pattern with real client/server in Vitest. See Code Examples for Socket.io testing. |
| TEST-03 | Client React components tested with Jest via react-scripts | Install @testing-library/react, mock socket.io-client module. See Client Testing section. |
| TEST-04 | Integration tests with real Socket.io client-server connections | Start real HTTP+Socket.io server in beforeAll, connect socket.io-client, verify end-to-end flow. See Integration Test pattern. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.x | Server test runner | Fast, ESM-native, works with Node.js CommonJS via config |
| @testing-library/react | ^16.x | React component testing | Standard for CRA, tests user-facing behavior |
| @testing-library/jest-dom | ^6.x | DOM assertion matchers | toBeInTheDocument, toHaveTextContent etc. |
| socket.io-client | ^4.5.4 | Socket.io client for integration tests | Already a project dependency (client side) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/user-event | ^14.x | Simulate user interactions | Click, type in React component tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest for server | Jest for server | Vitest is faster, but would need separate config; requirement says Vitest |
| @testing-library/react | Enzyme | Enzyme is deprecated for React 18, RTL is the standard |
| Real Socket.io for integration | socket.io-mock-ts | Mocks don't satisfy TEST-04's "real connections" requirement |

**Installation (server):**
```bash
cd server && npm install --save-dev vitest
```

**Installation (client):**
```bash
cd client && npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Architecture Patterns

### Required Refactoring: Extract Game Logic

The server needs restructuring before tests can be written. Current problems:
1. `checkForLines` is defined INSIDE `io.on('connection')` -- not importable
2. No `module.exports` on any function
3. `loadWords()` and `server.listen()` run at require-time -- importing `server.js` starts the server

**Target structure:**
```
server/
  gameLogic.js        # Pure functions: generateGrid, checkForLines, createPlayerGrid, createGame
  server.js           # Express + Socket.io setup, imports from gameLogic.js
  gameLogic.test.js   # Vitest: unit tests for pure game logic
  socket.test.js      # Vitest: Socket.io event handler tests
  integration.test.js # Vitest: real client-server integration test
client/
  src/
    App.js
    App.test.js       # Jest: React component rendering tests
```

### Pattern 1: Extractable Pure Logic Module
**What:** Move `generateGrid`, `checkForLines`, `createPlayerGrid` into `gameLogic.js` with `module.exports`
**When to use:** Always -- this is a prerequisite for TEST-01

```javascript
// server/gameLogic.js
function generateGrid(allWords, gridSize = '4x4') {
  // ... existing code ...
}

function checkForLines(marked, gridSize = '4x4') {
  // ... existing code (moved out of socket handler) ...
}

function createPlayerGrid(playerWords, gridSize = '4x4') {
  // ... existing code ...
}

module.exports = { generateGrid, checkForLines, createPlayerGrid };
```

### Pattern 2: Server Factory for Testing
**What:** Wrap server startup in a function so tests can create/destroy servers
**When to use:** Required for TEST-02 and TEST-04

```javascript
// server/server.js (refactored)
const { generateGrid, checkForLines, createPlayerGrid } = require('./gameLogic');

function createServer(wordsList) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });
  // ... setup socket handlers using imported functions ...
  return { app, httpServer, io };
}

// Only auto-start when run directly (not when imported by tests)
if (require.main === module) {
  const words = loadWords();
  const { httpServer } = createServer(words);
  httpServer.listen(3001, '0.0.0.0', () => console.log('Server running on port 3001'));
}

module.exports = { createServer, loadWords };
```

### Pattern 3: Mock socket.io-client in React Tests
**What:** Jest mock of socket.io-client for component tests
**When to use:** TEST-03 -- CRA Jest tests should not connect to real servers

### Anti-Patterns to Avoid
- **Testing socket events without cleanup:** Always close server and disconnect clients in `afterAll`/`afterEach`. Leaked connections cause hanging tests.
- **Importing server.js directly in tests:** Without the factory pattern, this starts a real server on port 3001 and reads CSV files, causing port conflicts and file-system dependencies.
- **Using `jest.useFakeTimers()` with Socket.io:** Socket.io relies on real timers for connection handshake. Fake timers prevent clients from connecting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM assertions | Custom DOM checks | @testing-library/jest-dom matchers | `.toBeInTheDocument()` etc. are standard |
| Waiting for socket events | Nested setTimeout chains | `waitFor()` promise wrapper | Clean, reliable async testing |
| React render setup | Manual ReactDOM.render | @testing-library/react `render()` | Auto-cleanup, act() wrapping |

## Common Pitfalls

### Pitfall 1: Port Conflicts in Socket.io Tests
**What goes wrong:** Tests bind to a fixed port (e.g., 3001), causing EADDRINUSE when running multiple test files
**Why it happens:** Hard-coded port in server setup
**How to avoid:** Use `httpServer.listen(0)` to get a random available port, then read it with `httpServer.address().port`
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: Hanging Tests from Unclosed Connections
**What goes wrong:** Test process never exits
**Why it happens:** Socket.io client or server connections not properly closed
**How to avoid:** Always call `io.close()` and `clientSocket.disconnect()` in `afterAll`. Add `--reporter=verbose` to spot which test hangs.
**Warning signs:** `vitest` command hangs after "Tests passed"

### Pitfall 3: Race Conditions in Event-Based Tests
**What goes wrong:** Tests intermittently fail because events arrive before listeners are set up
**Why it happens:** Socket.io emit is async; test assertions run before event callbacks fire
**How to avoid:** Use Promise-based patterns: wrap `socket.once(event)` in a Promise, await it
**Warning signs:** Tests pass sometimes, fail others

### Pitfall 4: CRA Jest Config Conflicts
**What goes wrong:** Trying to use Vitest config or ESM syntax in client tests
**Why it happens:** CRA controls the Jest config; you cannot customize it without ejecting
**How to avoid:** Use `react-scripts test` for client. Keep server tests (Vitest) and client tests (Jest) completely separate with separate npm scripts.
**Warning signs:** "Cannot use import statement outside a module" errors in client tests

### Pitfall 5: generateGrid is Non-Deterministic
**What goes wrong:** Tests for `generateGrid` fail intermittently because it uses `Math.random()`
**Why it happens:** Random shuffle produces different outputs each run
**How to avoid:** Test properties (correct count, correct difficulty distribution, no mutation) rather than exact output. For deterministic tests, mock `Math.random` or test the shuffle-invariant properties.

## Code Examples

### Game Logic Unit Tests (TEST-01)
```javascript
// server/gameLogic.test.js
const { describe, it, expect } = require('vitest');  // or import syntax
const { generateGrid, checkForLines, createPlayerGrid } = require('./gameLogic');

describe('checkForLines', () => {
  it('detects a horizontal line in 4x4', () => {
    const marked = Array(16).fill(false);
    // Mark first row: indices 0,1,2,3
    marked[0] = marked[1] = marked[2] = marked[3] = true;
    expect(checkForLines(marked, '4x4')).toBe(1);
  });

  it('detects diagonal in 3x3', () => {
    const marked = Array(9).fill(false);
    // Main diagonal: 0, 4, 8
    marked[0] = marked[4] = marked[8] = true;
    expect(checkForLines(marked, '3x3')).toBe(1);
  });

  it('returns 0 when no lines complete', () => {
    const marked = Array(16).fill(false);
    marked[0] = true;
    expect(checkForLines(marked, '4x4')).toBe(0);
  });

  it('counts multiple lines', () => {
    // All marked = all rows + all cols + 2 diagonals
    const marked = Array(9).fill(true);
    expect(checkForLines(marked, '3x3')).toBe(8); // 3 rows + 3 cols + 2 diags
  });
});

describe('generateGrid', () => {
  const testWords = [
    ...Array(14).fill(null).map((_, i) => ({ word: `easy${i}`, difficulty: 'leicht' })),
    { word: 'med1', difficulty: 'mittel' },
    { word: 'hard1', difficulty: 'schwer' },
  ];

  it('returns 16 words for 4x4', () => {
    const grid = generateGrid(testWords, '4x4');
    expect(grid).toHaveLength(16);
  });

  it('returns 9 words for 3x3', () => {
    const grid = generateGrid(testWords, '3x3');
    expect(grid).toHaveLength(9);
  });

  it('does not mutate input arrays', () => {
    const before = JSON.stringify(testWords);
    generateGrid(testWords, '4x4');
    expect(JSON.stringify(testWords)).toBe(before);
  });
});
```

### Socket.io Event Tests (TEST-02)
```javascript
// server/socket.test.js
// Source: https://socket.io/docs/v4/testing/ (adapted for this project)
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const { createServer: createHttpServer } = require('node:http');
const { Server } = require('socket.io');
const ioc = require('socket.io-client');

function waitFor(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

describe('Socket.io events', () => {
  let io, httpServer, clientSocket, port;

  beforeAll(() => {
    return new Promise((resolve) => {
      httpServer = createHttpServer();
      io = new Server(httpServer, { cors: { origin: '*' } });
      // Register the same event handlers as server.js (import setup function)
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        clientSocket = ioc(`http://localhost:${port}`);
        clientSocket.on('connect', resolve);
      });
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.disconnect();
  });

  it('create-game returns gameId', async () => {
    clientSocket.emit('create-game', { hostName: 'TestHost', gridSize: '4x4', maxRounds: 1 });
    const data = await waitFor(clientSocket, 'game-created');
    expect(data.gameId).toBeDefined();
    expect(typeof data.gameId).toBe('string');
  });
});
```

### Integration Test (TEST-04)
```javascript
// server/integration.test.js
const { describe, it, expect, beforeAll, afterAll } = require('vitest');
const ioc = require('socket.io-client');
const { createServer, loadWords } = require('./server');

describe('Integration: full game flow', () => {
  let httpServer, io, hostSocket, playerSocket, port;

  beforeAll(async () => {
    const words = loadWords();
    const server = createServer(words);
    httpServer = server.httpServer;
    io = server.io;

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });

    hostSocket = ioc(`http://localhost:${port}`);
    playerSocket = ioc(`http://localhost:${port}`);
    await Promise.all([
      new Promise(r => hostSocket.on('connect', r)),
      new Promise(r => playerSocket.on('connect', r)),
    ]);
  });

  afterAll(() => {
    hostSocket.disconnect();
    playerSocket.disconnect();
    io.close();
  });

  it('host creates game, player joins, host starts, player marks word', async () => {
    // Host creates
    hostSocket.emit('create-game', { hostName: 'Host', gridSize: '4x4', maxRounds: 1 });
    const created = await waitFor(hostSocket, 'game-created');

    // Player joins
    playerSocket.emit('join-game', { gameId: created.gameId, playerName: 'Player' });
    await waitFor(playerSocket, 'player-joined');

    // Host starts
    hostSocket.emit('start-game', { gameId: created.gameId });
    const started = await waitFor(playerSocket, 'game-started');
    expect(started.playerGrids).toBeDefined();
    expect(started.gridSize).toBe('4x4');
  });
});

function waitFor(socket, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), 5000);
    socket.once(event, (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}
```

### Client Component Test (TEST-03)
```javascript
// client/src/App.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    close: jest.fn(),
    id: 'test-socket-id',
  };
  return {
    io: jest.fn(() => mockSocket),
    __mockSocket: mockSocket,
  };
});

describe('App', () => {
  it('renders welcome screen with title', () => {
    render(<App />);
    expect(screen.getByText(/BINGO/)).toBeInTheDocument();
  });

  it('renders name input', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Gib deinen Namen ein/)).toBeInTheDocument();
  });

  it('renders create and join buttons', () => {
    render(<App />);
    expect(screen.getByText('Spiel erstellen')).toBeInTheDocument();
    expect(screen.getByText('Beitreten')).toBeInTheDocument();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Enzyme for React testing | @testing-library/react | 2020+ | Enzyme unmaintained for React 18 |
| Jest for all Node tests | Vitest for non-CRA Node projects | 2022+ | Faster, better ESM support |
| socket.io-mock libraries | Official Socket.io testing patterns | Socket.io v4 docs | Real client/server preferred for integration |

## Open Questions

1. **Vitest CommonJS compatibility**
   - What we know: Server uses `require()` (CommonJS). Vitest prefers ESM but supports CJS.
   - What's unclear: Whether Vitest needs any special config for CJS modules
   - Recommendation: Use `vitest.config.js` with `test: { globals: true }`. If CJS issues arise, test files can use `require()` syntax and vitest will handle it.

2. **CRA's Jest version compatibility with @testing-library/react v16**
   - What we know: react-scripts 5.0.1 bundles Jest 27. @testing-library/react v16 may need Jest 29+.
   - What's unclear: Exact compatibility
   - Recommendation: Use @testing-library/react v14 (compatible with Jest 27 and React 18) as a safer choice. Only upgrade if v14 has issues.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (server) | Vitest ^3.x |
| Framework (client) | Jest via react-scripts 5.0.1 |
| Config file (server) | `server/vitest.config.js` -- Wave 0 |
| Config file (client) | Built into react-scripts -- no config needed |
| Quick run command (server) | `cd server && npx vitest run --reporter=verbose` |
| Quick run command (client) | `cd client && npx react-scripts test --watchAll=false` |
| Full suite command | `cd server && npx vitest run && cd ../client && npx react-scripts test --watchAll=false` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | generateGrid, checkForLines, win condition | unit | `cd server && npx vitest run gameLogic.test.js` | No -- Wave 0 |
| TEST-02 | Socket.io create-game, join-game, mark-word, start-game | integration | `cd server && npx vitest run socket.test.js` | No -- Wave 0 |
| TEST-03 | React component rendering | unit | `cd client && npx react-scripts test --watchAll=false` | No -- Wave 0 |
| TEST-04 | Real client-server Socket.io flow | integration | `cd server && npx vitest run integration.test.js` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run` (server) or `cd client && npx react-scripts test --watchAll=false` (client)
- **Per wave merge:** Full suite: both server and client test commands
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `server/gameLogic.js` -- extract pure functions from server.js (prerequisite)
- [ ] `server/gameLogic.test.js` -- covers TEST-01
- [ ] `server/socket.test.js` -- covers TEST-02
- [ ] `server/integration.test.js` -- covers TEST-04
- [ ] `server/vitest.config.js` -- Vitest configuration
- [ ] `client/src/App.test.js` -- covers TEST-03
- [ ] `server/package.json` -- add vitest devDependency and test script
- [ ] `client/package.json` -- add @testing-library devDependencies
- [ ] Refactor `server/server.js` to use factory pattern and import from `gameLogic.js`

## Sources

### Primary (HIGH confidence)
- [Socket.io Official Testing Documentation](https://socket.io/docs/v4/testing/) - Vitest setup pattern, waitFor helper, complete examples
- Project source code analysis - server.js structure, package.json dependencies, CRA setup

### Secondary (MEDIUM confidence)
- [FreeCodeCamp - Testing Socket.io-client with Jest and RTL](https://www.freecodecamp.org/news/testing-socket-io-client-app-using-jest-and-react-testing-library-9cae93c070a3/) - Jest mock pattern for socket.io-client
- [Joao Martins - Integration Tests for WebSockets with Vitest](https://medium.com/@juaogui159/how-to-effectively-write-integration-tests-for-websockets-using-vitest-and-socket-io-360208978210) - Vitest + Socket.io patterns

### Tertiary (LOW confidence)
- [socket.io-mock-ts](https://github.com/james-elicx/socket.io-mock-ts) - Alternative mock approach (not recommended for this project since TEST-04 requires real connections)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Requirements specify Vitest (server) and Jest/react-scripts (client); libraries are well-established
- Architecture: HIGH - Refactoring pattern is straightforward; official Socket.io docs provide exact Vitest pattern
- Pitfalls: HIGH - Based on direct code analysis (checkForLines placement, module-level side effects, port conflicts)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable libraries, unlikely to change)
