# Schweisstal Bingo

Multiplayer bingo web app with real-time WebSocket communication.

## Architecture

- **Server**: Node.js + Express + Socket.io (`server/server.js`, `server/gameLogic.js`)
- **Client**: React 18 + Socket.io client (`client/src/App.js`)
- **Data**: Word lists use a central + per-mode split. `data/words.central.csv` is always loaded; `data/words.bgwp.csv` and `data/words.english.csv` contain mode-specific additions merged on top. All files share the `word,difficulty` schema. Host picks mode (`bgwp` | `english`) when creating a game; pools are merged at boot into `wordsByMode`.
- **Deploy**: Docker Compose, single container serving both client build and server on port 3001 (mapped to 3923 on host)
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) — tests, version bump, docker compose deploy, Discord notification via 922-Studio/workflows reusable workflow
- **Production URL**: https://sweatvalley-bingo.922-studio.com (Cloudflare Tunnel → localhost:3923)

## Local Development Setup

```bash
# Server (terminal 1)
cd server
npm install
npm run dev          # uses nodemon, auto-restarts on changes

# Client (terminal 2)
cd client
npm install
npm start            # React dev server on http://localhost:3000, proxies API to :3001
```

Client `proxy` in `package.json` forwards API requests to `http://localhost:3001` during development.

### With Docker

```bash
docker compose up --build    # app on http://localhost:3923
```

## Testing

### Server tests (Vitest)

```bash
cd server
npm test                     # vitest run --reporter=verbose
```

- **Unit tests**: `server/gameLogic.test.js` — tests `generateGrid`, `checkForLines`, `createPlayerGrid`
- **Integration tests**: `server/integration.test.js` — full Socket.io client/server round-trip tests
- **Socket tests**: `server/socket.test.js` — socket event handler tests
- Config: `server/vitest.config.js`

When writing new server tests:
- Use Vitest (`describe`/`it`/`expect`) — NOT Jest
- Import from `vitest` if needed: `import { describe, it, expect } from 'vitest'`
- Game logic is in `gameLogic.js` (pure functions, easy to unit test)
- Socket handlers are in `server.js` — use `socket.io-client` to write integration tests
- Server exports `{ server, io, app }` for test setup

### Client tests (React Testing Library + Jest)

```bash
cd client
CI=true npx react-scripts test --watchAll=false
```

- **Component tests**: `client/src/App.test.js` — renders welcome screen, form inputs, game states
- Mock `socket.io-client` with `jest.mock('socket.io-client', ...)` — see existing test file for pattern
- Use `@testing-library/react` for rendering and assertions
- Use `screen.getByText()`, `screen.getByPlaceholderText()`, `fireEvent` for interactions

When writing new client tests:
- Use Jest (via react-scripts) — NOT Vitest
- Mock the socket before importing App (jest.mock is hoisted)
- Clean up with `cleanup()` in `afterEach`
- The app is a single-component SPA (`App.js`) — all game states (welcome, lobby, playing, end) are rendered conditionally

## Key Conventions

- Server uses CommonJS (`require`/`module.exports`)
- Client uses ES modules (`import`/`export`)
- Socket.io transport: WebSocket-only (no polling fallback)
- CORS: locked to `https://sweatvalley-bingo.922-studio.com` and `http://localhost:3000`
- Game words: German language, loaded from `data/words.csv` at server start
- Grid sizes: 3x3, 4x4, 5x5 (configurable per game)
