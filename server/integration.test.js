const ioc = require('socket.io-client');
const { createServer, loadWords } = require('./server');

function waitFor(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

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

    hostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    playerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });

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

  it('host creates game, player joins, host starts, player marks word -- full flow', async () => {
    // Host creates game
    hostSocket.emit('create-game', { hostName: 'Host', gridSize: '4x4', maxRounds: 1 });
    const created = await waitFor(hostSocket, 'game-created');
    expect(created.gameId).toBeDefined();

    // Player joins
    playerSocket.emit('join-game', { gameId: created.gameId, playerName: 'Player' });
    const joined = await waitFor(playerSocket, 'player-joined');
    expect(joined.players.length).toBeGreaterThanOrEqual(2);
    const playerNames = joined.players.map(p => p.name);
    expect(playerNames).toContain('Host');
    expect(playerNames).toContain('Player');

    // Host starts game
    hostSocket.emit('start-game', { gameId: created.gameId });
    const [hostStarted, playerStarted] = await Promise.all([
      waitFor(hostSocket, 'game-started'),
      waitFor(playerSocket, 'game-started'),
    ]);

    expect(hostStarted.playerGrids).toBeDefined();
    expect(hostStarted.gridSize).toBe('4x4');
    expect(playerStarted.playerGrids).toBeDefined();
    expect(playerStarted.gridSize).toBe('4x4');

    // Player marks a word
    playerSocket.emit('mark-word', { gameId: created.gameId, index: 0 });
    const marked = await waitFor(playerSocket, 'player-marked');
    expect(marked.score).toBeDefined();
    expect(typeof marked.score).toBe('number');
    expect(marked.index).toBe(0);
    expect(marked.marked).toBe(true);
  });
});

describe('Integration: rejoin after disconnect', () => {
  let httpServer, io, port;

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
  });

  afterAll(() => {
    io.close();
  });

  it('player reconnects to active game with preserved state', async () => {
    const hostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    let playerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });

    await Promise.all([
      new Promise(r => hostSocket.on('connect', r)),
      new Promise(r => playerSocket.on('connect', r)),
    ]);

    // Host creates game
    hostSocket.emit('create-game', { hostName: 'Host', gridSize: '4x4' });
    const created = await waitFor(hostSocket, 'game-created');

    // Player joins
    playerSocket.emit('join-game', { gameId: created.gameId, playerName: 'Reconnector' });
    await waitFor(playerSocket, 'player-joined');

    // Host starts game
    hostSocket.emit('start-game', { gameId: created.gameId });
    const [, playerStarted] = await Promise.all([
      waitFor(hostSocket, 'game-started'),
      waitFor(playerSocket, 'game-started'),
    ]);

    // Player marks a word
    playerSocket.emit('mark-word', { gameId: created.gameId, index: 2 });
    await waitFor(playerSocket, 'player-marked');

    // Player disconnects (simulating network failure)
    const leftPromise = waitFor(hostSocket, 'player-left');
    playerSocket.disconnect();
    const leftData = await leftPromise;

    // Player should be marked as disconnected, not removed
    const disconnectedPlayer = leftData.players.find(p => p.name === 'Reconnector');
    expect(disconnectedPlayer).toBeDefined();
    expect(disconnectedPlayer.disconnected).toBe(true);

    // Player reconnects with new socket
    const newPlayerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => newPlayerSocket.on('connect', r));

    // Rejoin
    newPlayerSocket.emit('rejoin-game', { gameId: created.gameId, playerName: 'Reconnector' });
    const rejoinData = await waitFor(newPlayerSocket, 'rejoin-success');

    expect(rejoinData.gameId).toBe(created.gameId);
    expect(rejoinData.status).toBe('playing');
    expect(rejoinData.gridSize).toBe('4x4');
    expect(rejoinData.grid).toBeDefined();
    expect(Array.isArray(rejoinData.marked)).toBe(true);
    expect(rejoinData.marked[2]).toBe(true); // preserved marked state
    expect(rejoinData.endTime).toBeDefined();

    hostSocket.disconnect();
    newPlayerSocket.disconnect();
  });

  it('rejoin fails for non-existent game', async () => {
    const socket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => socket.on('connect', r));

    socket.emit('rejoin-game', { gameId: 'ZZZZ', playerName: 'Ghost' });
    const data = await waitFor(socket, 'rejoin-failed');
    expect(data.message).toContain('not found');

    socket.disconnect();
  });

  it('rejoin fails when no disconnected player matches', async () => {
    const hostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => hostSocket.on('connect', r));

    hostSocket.emit('create-game', { hostName: 'Solo', gridSize: '3x3' });
    const created = await waitFor(hostSocket, 'game-created');

    // Try to rejoin as someone who never joined
    const otherSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => otherSocket.on('connect', r));

    otherSocket.emit('rejoin-game', { gameId: created.gameId, playerName: 'Stranger' });
    const data = await waitFor(otherSocket, 'rejoin-failed');
    expect(data.message).toContain('No disconnected player');

    hostSocket.disconnect();
    otherSocket.disconnect();
  });

  it('host can rejoin and retains host privileges', async () => {
    let hostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    const playerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });

    await Promise.all([
      new Promise(r => hostSocket.on('connect', r)),
      new Promise(r => playerSocket.on('connect', r)),
    ]);

    // Host creates and starts game
    hostSocket.emit('create-game', { hostName: 'HostRejoiner', gridSize: '3x3' });
    const created = await waitFor(hostSocket, 'game-created');

    playerSocket.emit('join-game', { gameId: created.gameId, playerName: 'Keeper' });
    await waitFor(playerSocket, 'player-joined');

    hostSocket.emit('start-game', { gameId: created.gameId });
    await Promise.all([
      waitFor(hostSocket, 'game-started'),
      waitFor(playerSocket, 'game-started'),
    ]);

    // Host disconnects
    hostSocket.disconnect();
    await waitFor(playerSocket, 'player-left');

    // Host reconnects
    const newHostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => newHostSocket.on('connect', r));

    newHostSocket.emit('rejoin-game', { gameId: created.gameId, playerName: 'HostRejoiner' });
    const rejoinData = await waitFor(newHostSocket, 'rejoin-success');

    expect(rejoinData.isHost).toBe(true);

    newHostSocket.disconnect();
    playerSocket.disconnect();
  });

  it('join-game during active game acts as rejoin for disconnected player', async () => {
    const hostSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    let playerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });

    await Promise.all([
      new Promise(r => hostSocket.on('connect', r)),
      new Promise(r => playerSocket.on('connect', r)),
    ]);

    // Setup: create, join, start, mark
    hostSocket.emit('create-game', { hostName: 'Host', gridSize: '4x4' });
    const created = await waitFor(hostSocket, 'game-created');

    playerSocket.emit('join-game', { gameId: created.gameId, playerName: 'IncognitoPlayer' });
    await waitFor(playerSocket, 'player-joined');

    hostSocket.emit('start-game', { gameId: created.gameId });
    await Promise.all([
      waitFor(hostSocket, 'game-started'),
      waitFor(playerSocket, 'game-started'),
    ]);

    playerSocket.emit('mark-word', { gameId: created.gameId, index: 5 });
    await waitFor(playerSocket, 'player-marked');

    // Player disconnects (simulates closing incognito window)
    playerSocket.disconnect();
    await waitFor(hostSocket, 'player-left');

    // Player opens new incognito window and uses join-game (not rejoin-game)
    const newPlayerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise(r => newPlayerSocket.on('connect', r));

    newPlayerSocket.emit('join-game', { gameId: created.gameId, playerName: 'IncognitoPlayer' });
    const rejoinData = await waitFor(newPlayerSocket, 'rejoin-success');

    expect(rejoinData.status).toBe('playing');
    expect(rejoinData.grid).toBeDefined();
    expect(rejoinData.marked[5]).toBe(true);
    expect(rejoinData.gridSize).toBe('4x4');

    hostSocket.disconnect();
    newPlayerSocket.disconnect();
  });
});
