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
