# Phase 2: Bug Fixes - Research

**Researched:** 2026-03-05
**Domain:** JavaScript game logic, Socket.io client-server synchronization, React state management
**Confidence:** HIGH

## Summary

Phase 2 addresses five bugs in the Schweisstal Bingo app. All bugs are in existing code that has been fully read and analyzed. The fixes are straightforward JavaScript/React changes requiring no new libraries or architectural changes.

The bugs range from incorrect win conditions (requiring ALL lines instead of one), a missing client-side host check on the "Runde beenden" button, a round count mismatch between client and server, a potentially unsafe array mutation in `generateGrid`, and an unused `axios` dependency.

**Primary recommendation:** Fix each bug surgically in the existing files. No refactoring, no new dependencies, no structural changes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUGF-01 | First complete row/column/diagonal triggers bingo win (classic rules) | Win condition threshold change: `newScore >= 1` instead of `newScore >= maxBingos`. Client display update. |
| BUGF-02 | Only host can trigger "Runde beenden" | Add `isHost &&` guard to JSX rendering the button in `renderInGameScreen`. Server already enforces this. |
| BUGF-03 | Round count configurable and consistent client/server | Add `maxRounds` to create-game flow. Pass from client config, store on server, emit back to client. Fix hardcoded `max: 10` in client. |
| BUGF-04 | generateGrid does not mutate shared input arrays | Replace in-place `arr.sort()` shuffle with copy-then-shuffle: `const shuffle = (arr) => [...arr].sort(...)` |
| BUGF-05 | Unused axios dependency removed from client | Remove `"axios": "^1.3.0"` from `client/package.json` dependencies |
</phase_requirements>

## Standard Stack

No new libraries needed. All fixes use existing stack:

### Core (unchanged)
| Library | Version | Purpose |
|---------|---------|---------|
| Express | ^4.18.2 | HTTP server |
| Socket.io | ^4.5.4 | WebSocket (server) |
| socket.io-client | ^4.5.4 | WebSocket (client) |
| React | ^18.2.0 | UI framework |
| csv-parse | ^5.4.1 | Word list loading |

### Removal
| Library | Action | Reason |
|---------|--------|--------|
| axios | Remove from client/package.json | BUGF-05: unused, not imported anywhere |

## Architecture Patterns

No architectural changes needed. All fixes are within existing patterns.

### File Modification Map

```
server/server.js     # BUGF-01, BUGF-03, BUGF-04
client/src/App.js    # BUGF-01, BUGF-02, BUGF-03
client/package.json  # BUGF-05
```

## Bug Analysis

### BUGF-01: Win Condition (Classic Bingo Rules)

**Current behavior:** Win requires ALL possible lines completed (8 for 3x3, 10 for 4x4).

**Root cause (server/server.js lines 282-283):**
```javascript
const maxBingos = game.gridSize === '3x3' ? 8 : 10;
if (newScore >= maxBingos) {
```

**Fix:** Change threshold to 1 (first complete line wins):
```javascript
if (newScore >= 1) {
```

**Client impact (client/src/App.js lines 297-298):** The display shows `bingos / 10` (or 8) as if all lines needed. Update to show classic bingo status:
```javascript
// Change from "Deine Bingos: X / 10" to simple win indicator
Deine Bingos: {bingos}
{bingos >= 1 && ' - GEWONNEN!'}
```

**Confidence:** HIGH -- logic is clear, `checkForLines` already counts correctly.

### BUGF-02: Host-Only "Runde beenden" Button

**Current behavior:** ALL players see the "Runde beenden" button (client/src/App.js line 324-328). Server correctly rejects non-host requests (line 297), but the UI still shows it.

**Root cause:** Missing `isHost` guard in JSX.

**Fix (client/src/App.js):**
```javascript
{gameStatus === 'playing' && isHost && (
  <button className="btn-primary" onClick={handleEndRound}>
    Runde beenden
  </button>
)}
```

**Confidence:** HIGH -- `isHost` state already exists and is set correctly on game creation (line 42) and defaults to false for joiners.

### BUGF-03: Round Count Configuration

**Current behavior:**
- Server: `maxRounds: 1` (hardcoded in `createGame`, line 99)
- Client: `roundInfo` defaults to `{ current: 0, max: 10 }` (line 20)
- Client `round-finished` handler hardcodes `max: 10` (line 109)
- Client `game-started` handler hardcodes `max: 1` (line 73)
- No UI for host to set round count
- `create-game` event does not send maxRounds

**Fix requires changes in 3 places:**

1. **Client welcome screen:** Add round count input for host (next to grid size selector)
2. **Client `create-game` emit:** Include `maxRounds` in event data
3. **Server `create-game` handler:** Read `data.maxRounds` and store on game object
4. **Server `game-started` emit:** Include `maxRounds` in response
5. **Client `game-started` handler:** Read `maxRounds` from server response
6. **Client `round-finished` handler:** Use actual `maxRounds` not hardcoded 10

**Confidence:** HIGH -- straightforward data plumbing through existing event flow.

### BUGF-04: generateGrid Array Mutation

**Current behavior (server/server.js line 64):**
```javascript
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
```
`Array.sort()` mutates in-place. While `filter()` on lines 60-62 creates new arrays each call (so `allWords`/`words` global isn't directly mutated), the shuffle still mutates the filtered arrays unnecessarily. This is unsafe practice and the requirement explicitly asks for no mutation.

**Fix:**
```javascript
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
```

The spread operator creates a copy before sorting. This is the minimal fix. A Fisher-Yates shuffle would be more correct for randomness, but the requirement is about mutation prevention, not shuffle quality.

**Confidence:** HIGH -- single-character fix with clear semantics.

### BUGF-05: Remove Unused axios

**Current behavior:** `client/package.json` lists `"axios": "^1.3.0"` in dependencies. No file in the codebase imports or requires axios.

**Fix:** Remove the line from `client/package.json` dependencies.

**Confidence:** HIGH -- verified no imports exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array shuffling | Custom Fisher-Yates | `[...arr].sort(() => Math.random() - 0.5)` | Existing pattern, just needs copy. Shuffle quality is not a requirement. |

## Common Pitfalls

### Pitfall 1: Changing Win Condition Without Updating Client Display
**What goes wrong:** Server sends `player-won` at 1 bingo, but client still displays "X / 10" progress bar implying all lines needed.
**How to avoid:** Update both server threshold AND client display text simultaneously.

### Pitfall 2: Round-Finished Handler Using Wrong Grid Size for Reset
**What goes wrong:** Line 110 in App.js hardcodes `Array(16).fill(false)` for reset, ignoring 3x3 grids.
**How to avoid:** Use `gridSize` state to compute correct array size: `Array(gridSize === '3x3' ? 9 : 16).fill(false)`.

### Pitfall 3: maxRounds Not Validated
**What goes wrong:** User could input 0 or negative rounds.
**How to avoid:** Clamp to minimum 1 on both client (input min=1) and server (Math.max(1, data.maxRounds)).

### Pitfall 4: isHost State Not Set for Joiners
**What goes wrong:** If `isHost` initialization is wrong, joiners could see host controls.
**How to avoid:** `isHost` defaults to `false` (line 18). Only set to `true` in `game-created` handler (line 42). This is already correct -- just don't break it.

## Code Examples

### BUGF-01 Server Fix (server/server.js ~line 282)
```javascript
// BEFORE:
const maxBingos = game.gridSize === '3x3' ? 8 : 10;
if (newScore >= maxBingos) {

// AFTER:
if (newScore >= 1) {
```

### BUGF-02 Client Fix (client/src/App.js ~line 324)
```javascript
// BEFORE:
{gameStatus === 'playing' && (
  <button className="btn-primary" onClick={handleEndRound}>
    Runde beenden
  </button>
)}

// AFTER:
{gameStatus === 'playing' && isHost && (
  <button className="btn-primary" onClick={handleEndRound}>
    Runde beenden
  </button>
)}
```

### BUGF-03 Server Fix (server/server.js ~line 88)
```javascript
// In createGame function, accept maxRounds parameter:
function createGame(gameId, hostId, hostName, gridSize = '4x4', maxRounds = 1) {
  const game = {
    // ...existing fields...
    maxRounds: Math.max(1, maxRounds || 1)
  };
  // ...
}

// In create-game handler:
socket.on('create-game', (data) => {
  const maxRounds = parseInt(data.maxRounds, 10) || 1;
  const game = createGame(gameId, socket.id, data.hostName, gridSize, maxRounds);
  // ...
});

// In game-started emit, include maxRounds:
io.to(gameId).emit('game-started', { playerGrids, gridSize, maxRounds: game.maxRounds });
```

### BUGF-03 Client Fix (client/src/App.js)
```javascript
// In game-started handler:
setRoundInfo({ current: 1, max: data.maxRounds || 1 });

// In round-finished handler (line 109):
setRoundInfo(prev => ({ current: data.nextRound, max: prev.max }));
// Also fix hardcoded Array(16):
const gridTotal = gridSize === '3x3' ? 9 : 16;
setMarked(Array(gridTotal).fill(false));

// In welcome screen, add maxRounds state and input
const [maxRounds, setMaxRounds] = useState(1);
// Add input in create-game section
// Pass in create-game emit:
socket.emit('create-game', { hostName: playerName, gridSize, maxRounds });
```

### BUGF-04 Fix (server/server.js line 64)
```javascript
// BEFORE:
const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

// AFTER:
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
```

### BUGF-05 Fix (client/package.json)
```json
// Remove this line from dependencies:
"axios": "^1.3.0"
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (not yet installed, Phase 3 scope) |
| Config file | none -- Phase 3 will set up |
| Quick run command | N/A (no tests exist yet) |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUGF-01 | First line triggers win | manual | Start game, complete one row, verify win popup | N/A -- no test infra yet |
| BUGF-02 | Only host sees end-round button | manual | Join as non-host, verify no button visible | N/A |
| BUGF-03 | Round count respected | manual | Set 3 rounds, play through, verify game ends after 3 | N/A |
| BUGF-04 | No array mutation | manual | Start game with 3+ players, verify each gets unique grid | N/A |
| BUGF-05 | axios removed | unit | `grep -r "axios" client/package.json` returns nothing | N/A |

### Sampling Rate
- **Per task commit:** Manual verification (no automated tests until Phase 3)
- **Phase gate:** All 5 behaviors manually verified

### Wave 0 Gaps
- No test infrastructure exists -- this is Phase 3 scope
- Manual testing is sufficient for these bug fixes since Phase 3 will add automated tests that verify these exact behaviors (TEST-01: generateGrid, checkForLines, win condition)

## Open Questions

1. **maxRounds UI design**
   - What we know: Need an input for host to set round count
   - What's unclear: Exact UI placement and styling
   - Recommendation: Add a simple number input next to grid size selector on welcome screen, matching existing style

2. **Should "Runde beenden" also regenerate grids for next round?**
   - What we know: Current `round-finished` handler resets marked array but keeps same grid
   - What's unclear: Whether new grids should be generated per round
   - Recommendation: Keep current behavior (same grid, reset marks) -- regenerating grids is a feature addition, not a bug fix

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `server/server.js` (367 lines)
- Direct code analysis of `client/src/App.js` (407 lines)
- Direct code analysis of `client/package.json` and `server/package.json`

### Secondary
- None needed -- all bugs are in-codebase logic errors requiring no external research

## Metadata

**Confidence breakdown:**
- BUGF-01 (win condition): HIGH -- clear threshold error, one-line fix
- BUGF-02 (host button): HIGH -- missing JSX guard, one-line fix
- BUGF-03 (round config): HIGH -- data plumbing through existing event system
- BUGF-04 (array mutation): HIGH -- spread-before-sort, one-line fix
- BUGF-05 (remove axios): HIGH -- delete one line from package.json

**Research date:** 2026-03-05
**Valid until:** N/A (codebase-specific, no external dependencies to go stale)
