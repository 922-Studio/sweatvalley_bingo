const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const cors = require('cors');
const { generateGrid, checkForLines, createPlayerGrid } = require('./gameLogic');

// Load words from CSV
function loadWords() {
  const csvPath = path.join(__dirname, '../data/words.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Trim whitespace from difficulty field
  const words = records.map(w => ({
    word: w.word.trim(),
    difficulty: w.difficulty.trim()
  }));

  console.log(`Loaded ${words.length} words from CSV`);
  const easy = words.filter(w => w.difficulty === 'leicht').length;
  const medium = words.filter(w => w.difficulty === 'mittel').length;
  const hard = words.filter(w => w.difficulty === 'schwer').length;
  console.log(`Easy: ${easy}, Medium: ${medium}, Hard: ${hard}`);
  console.log('Sample word:', words[0]);

  return words;
}

function createServer(wordsList) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = socketIO(httpServer, {
    cors: {
      origin: [
        "https://sweatvalley-bingo.922-studio.com",
        "http://localhost:3000"
      ],
      methods: ["GET", "POST"]
    },
    transports: ['websocket'],
    pingInterval: 10000,
    pingTimeout: 5000
  });

  app.use(cors({
    origin: [
      "https://sweatvalley-bingo.922-studio.com",
      "http://localhost:3000"
    ]
  }));
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Serve React build
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));

  // Game State (per server instance)
  const games = new Map();

  // Create game
  function createGame(gameId, hostId, hostName, gridSize = '4x4', maxRounds = 1) {
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
      maxRounds: Math.max(1, parseInt(maxRounds, 10) || 1)
    };
    games.set(gameId, game);
    return game;
  }

  // Socket events
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Host creates a game
    socket.on('create-game', (data) => {
      const gameId = Math.random().toString(36).substr(2, 9);
      const gridSize = data.gridSize || '4x4';
      const maxRounds = parseInt(data.maxRounds, 10) || 1;
      const game = createGame(gameId, socket.id, data.hostName, gridSize, maxRounds);
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
      const selectedWords = generateGrid(wordsList, gridSize);
      game.selectedWords = selectedWords;
      game.status = 'playing';
      game.startTime = Date.now();
      game.rounds = 0;

      // Generate grid for each player
      const playerGrids = {};
      game.players.forEach((player, playerId) => {
        const playerWords = generateGrid(wordsList, gridSize);
        const grid = createPlayerGrid(playerWords, gridSize);
        playerGrids[playerId] = grid;
        player.marked = Array(gridTotal).fill(false);
        player.score = 0;
        console.log(`Generated ${gridSize} grid for ${player.name}:`, grid);
      });

      console.log('Sending game-started with playerGrids:', Object.keys(playerGrids));
      io.to(gameId).emit('game-started', { playerGrids, gridSize, maxRounds: game.maxRounds });
    });

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

  return { app, httpServer, io };
}

// Only auto-start when run directly (not when imported by tests)
if (require.main === module) {
  const words = loadWords();
  const { httpServer } = createServer(words);
  httpServer.listen(3001, '0.0.0.0', () => {
    console.log('Server running on port 3001');
  });
}

module.exports = { createServer, loadWords };
