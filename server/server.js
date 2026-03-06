const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const cors = require('cors');
const { generateGrid, generateDifficultyLayout, generateGridFromLayout, checkForLines, createPlayerGrid } = require('./gameLogic');

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

  // Game duration in milliseconds (1 hour)
  const GAME_DURATION_MS = 60 * 60 * 1000;

  // Create game
  function createGame(gameId, hostId, hostName, gridSize = '4x4', gameDuration = GAME_DURATION_MS, sameWords = true) {
    const game = {
      id: gameId,
      hostId: hostId,
      hostName: hostName,
      gridSize: gridSize,
      sameWords: sameWords,
      players: new Map(),
      status: 'waiting',
      startTime: null,
      endTime: null,
      selectedWords: [],
      gameDuration: gameDuration,
      timer: null
    };
    games.set(gameId, game);
    return game;
  }

  // Socket events
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Host creates a game
    socket.on('create-game', (data) => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      let gameId;
      do {
        gameId = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      } while (games.has(gameId));
      const gridSize = data.gridSize || '4x4';
      const gameDuration = Math.max(1, parseInt(data.gameDuration, 10) || 60) * 60 * 1000;
      const sameWords = data.sameWords !== undefined ? data.sameWords : true;
      const game = createGame(gameId, socket.id, data.hostName, gridSize, gameDuration, sameWords);
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

      // If game is active and a disconnected player with same name exists, treat as rejoin
      if (game.status === 'playing') {
        let oldPlayerId = null;
        let oldPlayer = null;
        for (const [pid, p] of game.players) {
          if (p.name === playerName && p.disconnected) {
            oldPlayerId = pid;
            oldPlayer = p;
            break;
          }
        }

        if (oldPlayer) {
          game.players.delete(oldPlayerId);
          oldPlayer.id = socket.id;
          oldPlayer.disconnected = false;
          game.players.set(socket.id, oldPlayer);

          if (game.playerGrids && game.playerGrids[oldPlayerId]) {
            game.playerGrids[socket.id] = game.playerGrids[oldPlayerId];
            delete game.playerGrids[oldPlayerId];
          }

          if (game.hostId === oldPlayerId) {
            game.hostId = socket.id;
          }

          socket.join(gameId);
          console.log(`Player ${playerName} rejoined via join-game (${oldPlayerId} -> ${socket.id})`);

          socket.emit('rejoin-success', {
            gameId,
            grid: game.playerGrids?.[socket.id] || [],
            marked: oldPlayer.marked,
            score: oldPlayer.score,
            gridSize: game.gridSize,
            endTime: game.endTime,
            status: game.status,
            isHost: game.hostId === socket.id,
            players: Array.from(game.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              score: p.score,
              disconnected: p.disconnected || false
            }))
          });

          io.to(gameId).emit('player-joined', {
            players: Array.from(game.players.values()).map(p => ({
              id: p.id,
              name: p.name,
              score: p.score,
              disconnected: p.disconnected || false
            }))
          });
          return;
        }
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

      game.status = 'playing';
      game.startTime = Date.now();
      game.endTime = game.startTime + game.gameDuration;

      // Generate difficulty layout once (shared across all players)
      const layout = generateDifficultyLayout(wordsList, gridSize);

      // Generate grid for each player
      game.playerGrids = {};
      const playerGrids = game.playerGrids;
      if (game.sameWords) {
        // Same words: generate one grid, share it
        const sharedWords = generateGridFromLayout(wordsList, layout);
        game.selectedWords = sharedWords;
        const sharedGrid = createPlayerGrid(sharedWords, gridSize);
        game.players.forEach((player, playerId) => {
          playerGrids[playerId] = sharedGrid;
          player.marked = Array(gridTotal).fill(false);
          player.score = 0;
          console.log(`Generated ${gridSize} shared grid for ${player.name}:`, sharedGrid);
        });
      } else {
        // Different words: same difficulty layout, different words per player
        game.players.forEach((player, playerId) => {
          const playerWords = generateGridFromLayout(wordsList, layout);
          const grid = createPlayerGrid(playerWords, gridSize);
          playerGrids[playerId] = grid;
          player.marked = Array(gridTotal).fill(false);
          player.score = 0;
          console.log(`Generated ${gridSize} grid for ${player.name}:`, grid);
        });
      }

      // Set timer to end the game automatically
      game.timer = setTimeout(() => {
        if (game.status === 'playing') {
          game.status = 'finished';
          const scores = Array.from(game.players.values()).map(p => ({
            name: p.name,
            score: p.score
          }));
          io.to(gameId).emit('game-finished', { scores });
        }
      }, game.gameDuration);

      console.log('Sending game-started with playerGrids:', Object.keys(playerGrids));
      io.to(gameId).emit('game-started', {
        playerGrids,
        gridSize,
        endTime: game.endTime
      });
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
    });

    // End game (host can end early)
    socket.on('end-game', (data) => {
      const { gameId } = data;
      const game = games.get(gameId);

      if (!game || game.hostId !== socket.id) return;

      if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
      }

      game.status = 'finished';
      const scores = Array.from(game.players.values()).map(p => ({
        name: p.name,
        score: p.score
      }));
      io.to(gameId).emit('game-finished', { scores });
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
          if (game.timer) clearTimeout(game.timer);
          games.delete(gameId);
        }
      }
    });

    // Rejoin after disconnect — match by playerName + gameId
    socket.on('rejoin-game', (data) => {
      const { gameId, playerName } = data;
      const game = games.get(gameId);

      if (!game) {
        socket.emit('rejoin-failed', { message: 'Game not found' });
        return;
      }

      // Find disconnected player by name
      let oldPlayerId = null;
      let oldPlayer = null;
      for (const [pid, p] of game.players) {
        if (p.name === playerName && p.disconnected) {
          oldPlayerId = pid;
          oldPlayer = p;
          break;
        }
      }

      if (!oldPlayer) {
        socket.emit('rejoin-failed', { message: 'No disconnected player found' });
        return;
      }

      // Move player entry to new socket id
      game.players.delete(oldPlayerId);
      oldPlayer.id = socket.id;
      oldPlayer.disconnected = false;
      game.players.set(socket.id, oldPlayer);

      // Remap grid to new socket id
      if (game.playerGrids && game.playerGrids[oldPlayerId]) {
        game.playerGrids[socket.id] = game.playerGrids[oldPlayerId];
        delete game.playerGrids[oldPlayerId];
      }

      // Update host reference if needed
      if (game.hostId === oldPlayerId) {
        game.hostId = socket.id;
      }

      socket.join(gameId);
      console.log(`Player ${playerName} rejoined game ${gameId} (${oldPlayerId} -> ${socket.id})`);

      // Send full state back to rejoining player
      socket.emit('rejoin-success', {
        gameId,
        grid: game.playerGrids?.[socket.id] || [],
        marked: oldPlayer.marked,
        score: oldPlayer.score,
        gridSize: game.gridSize,
        endTime: game.endTime,
        status: game.status,
        isHost: game.hostId === socket.id,
        players: Array.from(game.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
          disconnected: p.disconnected || false
        }))
      });

      // Notify others
      io.to(gameId).emit('player-joined', {
        players: Array.from(game.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
          disconnected: p.disconnected || false
        }))
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      games.forEach((game, gameId) => {
        if (game.players.has(socket.id)) {
          const player = game.players.get(socket.id);

          if (game.status === 'playing') {
            // During active game: keep player but mark as disconnected
            player.disconnected = true;
            io.to(gameId).emit('player-left', {
              players: Array.from(game.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                disconnected: p.disconnected || false
              }))
            });
          } else {
            // In lobby or finished: remove player
            game.players.delete(socket.id);
            io.to(gameId).emit('player-left', {
              players: Array.from(game.players.values())
            });

            if (game.players.size === 0) {
              if (game.timer) clearTimeout(game.timer);
              games.delete(gameId);
            }
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
