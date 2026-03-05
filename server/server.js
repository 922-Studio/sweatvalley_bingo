const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling']
  }
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve React build
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Game State
const games = new Map();
let words = [];

// Load words from CSV
function loadWords() {
  const csvPath = path.join(__dirname, '../data/words.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Trim whitespace from difficulty field
  words = records.map(w => ({
    word: w.word.trim(),
    difficulty: w.difficulty.trim()
  }));

  console.log(`Loaded ${words.length} words from CSV`);
  const easy = words.filter(w => w.difficulty === 'leicht').length;
  const medium = words.filter(w => w.difficulty === 'mittel').length;
  const hard = words.filter(w => w.difficulty === 'schwer').length;
  console.log(`Easy: ${easy}, Medium: ${medium}, Hard: ${hard}`);
  console.log('Sample word:', words[0]);
}

// Generate random grid with fixed word distribution
function generateGrid(allWords, gridSize = '4x4') {
  const easy = allWords.filter(w => w.difficulty === 'leicht');
  const medium = allWords.filter(w => w.difficulty === 'mittel');
  const hard = allWords.filter(w => w.difficulty === 'schwer');

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  let selected = [];

  if (gridSize === '3x3') {
    // 3x3: 1 hard + 1 medium + 7 easy = 9 total
    selected = [
      ...shuffle(hard).slice(0, 1),
      ...shuffle(medium).slice(0, 1),
      ...shuffle(easy).slice(0, 7)
    ];
  } else {
    // 4x4: 1 hard + 1 medium + 14 easy = 16 total
    selected = [
      ...shuffle(hard).slice(0, 1),
      ...shuffle(medium).slice(0, 1),
      ...shuffle(easy).slice(0, 14)
    ];
  }

  return shuffle(selected);
}

// Create game
function createGame(gameId, hostId, hostName, gridSize = '4x4') {
  const game = {
    id: gameId,
    hostId: hostId,
    hostName: hostName,
    gridSize: gridSize,
    players: new Map(),
    status: 'waiting',
    startTime: null,
    selectedWords: [],
    rounds: 0,
    maxRounds: 1
  };
  games.set(gameId, game);
  return game;
}

// Generate grid for a player
function createPlayerGrid(playerWords, gridSize = '4x4') {
  const grid = [];
  const size = gridSize === '3x3' ? 3 : 4;
  for (let i = 0; i < size; i++) {
    grid.push(playerWords.slice(i * size, (i + 1) * size));
  }
  return grid;
}

// Socket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Host creates a game
  socket.on('create-game', (data) => {
    const gameId = Math.random().toString(36).substr(2, 9);
    const gridSize = data.gridSize || '4x4';
    const game = createGame(gameId, socket.id, data.hostName, gridSize);
    socket.join(gameId);

    // Add host as a player
    const hostPlayer = {
      id: socket.id,
      name: data.hostName,
      marked: [],
      ready: false,
      score: 0
    };
    game.players.set(socket.id, hostPlayer);

    socket.emit('game-created', { gameId, game });
    io.to(gameId).emit('player-joined', {
      players: Array.from(game.players.values())
    });
  });

  // Join existing game
  socket.on('join-game', (data) => {
    const { gameId, playerName } = data;
    const game = games.get(gameId);

    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    socket.join(gameId);
    const player = {
      id: socket.id,
      name: playerName,
      marked: [],
      ready: false,
      score: 0
    };

    game.players.set(socket.id, player);
    io.to(gameId).emit('player-joined', {
      players: Array.from(game.players.values())
    });
  });

  // Start game
  socket.on('start-game', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    console.log(`Start game called for gameId: ${gameId}, gridSize: ${game?.gridSize}`);
    console.log(`Game found: ${!!game}, Host check: ${game?.hostId === socket.id}`);

    if (!game || game.hostId !== socket.id) {
      console.log('Game start denied - invalid game or not host');
      return;
    }

    const gridSize = game.gridSize || '4x4';
    const gridTotal = gridSize === '3x3' ? 9 : 16;

    // Select random words for this game session
    const selectedWords = generateGrid(words, gridSize);
    game.selectedWords = selectedWords;
    game.status = 'playing';
    game.startTime = Date.now();
    game.rounds = 0;

    // Generate grid for each player
    const playerGrids = {};
    game.players.forEach((player, playerId) => {
      const playerWords = generateGrid(words, gridSize);
      const grid = createPlayerGrid(playerWords, gridSize);
      playerGrids[playerId] = grid;
      player.marked = Array(gridTotal).fill(false);
      player.score = 0;
      console.log(`Generated ${gridSize} grid for ${player.name}:`, grid);
    });

    console.log('Sending game-started with playerGrids:', Object.keys(playerGrids));
    io.to(gameId).emit('game-started', { playerGrids, gridSize });
  });

// Check if a player has a complete line (horizontal, vertical, diagonal)
function checkForLines(marked, gridSize = '4x4') {
  let lineCount = 0;
  const size = gridSize === '3x3' ? 3 : 4;
  const total = size * size;

  // Check horizontal lines
  for (let row = 0; row < size; row++) {
    const lineStart = row * size;
    let isComplete = true;
    for (let col = 0; col < size; col++) {
      if (!marked[lineStart + col]) {
        isComplete = false;
        break;
      }
    }
    if (isComplete) lineCount++;
  }

  // Check vertical lines
  for (let col = 0; col < size; col++) {
    let isComplete = true;
    for (let row = 0; row < size; row++) {
      if (!marked[col + row * size]) {
        isComplete = false;
        break;
      }
    }
    if (isComplete) lineCount++;
  }

  // Check diagonal (top-left to bottom-right)
  let isDiag1Complete = true;
  for (let i = 0; i < size; i++) {
    if (!marked[i * (size + 1)]) {
      isDiag1Complete = false;
      break;
    }
  }
  if (isDiag1Complete) lineCount++;

  // Check diagonal (top-right to bottom-left)
  let isDiag2Complete = true;
  for (let i = 0; i < size; i++) {
    if (!marked[(i + 1) * (size - 1)]) {
      isDiag2Complete = false;
      break;
    }
  }
  if (isDiag2Complete) lineCount++;

  return lineCount;
}

  // Player marks a word
  socket.on('mark-word', (data) => {
    const { gameId, index } = data;
    const game = games.get(gameId);

    if (!game) return;

    const player = game.players.get(socket.id);
    if (!player) return;

    player.marked[index] = !player.marked[index];
    const newScore = checkForLines(player.marked, game.gridSize);
    player.score = newScore;

    io.to(gameId).emit('player-marked', {
      playerId: socket.id,
      playerName: player.name,
      index,
      marked: player.marked[index],
      score: newScore
    });

    // Check win condition
    if (newScore >= 1) {
      io.to(gameId).emit('player-won', {
        playerId: socket.id,
        playerName: player.name,
        bingos: newScore
      });
    }
  });

  // End round
  socket.on('end-round', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    if (!game || game.hostId !== socket.id) return;

    game.rounds += 1;
    const gridTotal = game.gridSize === '3x3' ? 9 : 16;

    const scores = Array.from(game.players.values()).map(p => ({
      name: p.name,
      score: checkForLines(p.marked, game.gridSize)
    }));

    if (game.rounds >= game.maxRounds) {
      game.status = 'finished';
      io.to(gameId).emit('game-finished', { scores });
    } else {
      // Reset for next round
      game.players.forEach(p => {
        p.marked = Array(gridTotal).fill(false);
        p.score = 0;
      });
      io.to(gameId).emit('round-finished', { scores, nextRound: game.rounds + 1 });
    }
  });

  // Leave game
  socket.on('leave-game', (data) => {
    const { gameId } = data;
    const game = games.get(gameId);

    if (game) {
      game.players.delete(socket.id);
      socket.leave(gameId);
      io.to(gameId).emit('player-left', {
        players: Array.from(game.players.values())
      });

      if (game.players.size === 0) {
        games.delete(gameId);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Clean up player from all games
    games.forEach((game, gameId) => {
      if (game.players.has(socket.id)) {
        game.players.delete(socket.id);
        io.to(gameId).emit('player-left', {
          players: Array.from(game.players.values())
        });

        if (game.players.size === 0) {
          games.delete(gameId);
        }
      }
    });
  });
});

// SPA catch-all: serve index.html for all unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Load words on startup
loadWords();

server.listen(3001, '0.0.0.0', () => {
  console.log('Server running on port 3001');
});
