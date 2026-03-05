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

describe('Socket.io events', () => {
  let httpServer, io, clientSocket, port;

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

    clientSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise((resolve) => clientSocket.on('connect', resolve));
  });

  afterAll(() => {
    clientSocket.disconnect();
    io.close();
  });

  it('create-game emits game-created with gameId string', async () => {
    clientSocket.emit('create-game', { hostName: 'TestHost', gridSize: '4x4', maxRounds: 1 });
    const data = await waitFor(clientSocket, 'game-created');
    expect(data.gameId).toBeDefined();
    expect(typeof data.gameId).toBe('string');
  });

  it('join-game emits player-joined with players array containing the joiner', async () => {
    // First create a game to get a valid gameId
    clientSocket.emit('create-game', { hostName: 'Host2', gridSize: '4x4', maxRounds: 1 });
    const created = await waitFor(clientSocket, 'game-created');

    // Now join with a second client
    const joinerSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise((resolve) => joinerSocket.on('connect', resolve));

    joinerSocket.emit('join-game', { gameId: created.gameId, playerName: 'Joiner' });
    const data = await waitFor(joinerSocket, 'player-joined');
    expect(Array.isArray(data.players)).toBe(true);
    const joiner = data.players.find(p => p.name === 'Joiner');
    expect(joiner).toBeDefined();

    joinerSocket.disconnect();
  });

  it('join-game with invalid gameId emits error with message', async () => {
    const errorSocket = ioc(`http://localhost:${port}`, { transports: ['websocket'] });
    await new Promise((resolve) => errorSocket.on('connect', resolve));

    errorSocket.emit('join-game', { gameId: 'nonexistent123', playerName: 'Ghost' });
    const data = await waitFor(errorSocket, 'error');
    expect(data.message).toBeDefined();
    expect(data.message).toContain('not found');

    errorSocket.disconnect();
  });

  it('start-game emits game-started with playerGrids and gridSize', async () => {
    // Set up listeners BEFORE emitting to avoid race conditions
    const createdPromise = waitFor(clientSocket, 'game-created');
    const joinedPromise = waitFor(clientSocket, 'player-joined');
    clientSocket.emit('create-game', { hostName: 'StartHost', gridSize: '4x4', maxRounds: 1 });
    const created = await createdPromise;
    await joinedPromise;

    const startedPromise = waitFor(clientSocket, 'game-started');
    clientSocket.emit('start-game', { gameId: created.gameId });
    const data = await startedPromise;
    expect(data.playerGrids).toBeDefined();
    expect(data.gridSize).toBe('4x4');
  });

  it('mark-word emits player-marked with score', async () => {
    const createdPromise = waitFor(clientSocket, 'game-created');
    const joinedPromise = waitFor(clientSocket, 'player-joined');
    clientSocket.emit('create-game', { hostName: 'MarkHost', gridSize: '4x4', maxRounds: 1 });
    const created = await createdPromise;
    await joinedPromise;

    const startedPromise = waitFor(clientSocket, 'game-started');
    clientSocket.emit('start-game', { gameId: created.gameId });
    await startedPromise;

    const markedPromise = waitFor(clientSocket, 'player-marked');
    clientSocket.emit('mark-word', { gameId: created.gameId, index: 0 });
    const data = await markedPromise;
    expect(data.score).toBeDefined();
    expect(typeof data.score).toBe('number');
    expect(data.index).toBe(0);
    expect(data.marked).toBe(true);
  });
});
