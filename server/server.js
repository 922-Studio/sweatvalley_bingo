const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const cors = require('cors');
const { generateGrid, generateDifficultyLayout, generateGridFromLayout, checkForLines, createPlayerGrid } = require('./gameLogic');
const { updateLeaderboard, getLeaderboard } = require('./leaderboard');

// Allowed modes and their mode-specific CSV filenames (loaded on top of central)
const MODE_FILES = {
  bgwp: 'words.bgwp.csv',
  english: 'words.english.csv'
};
const CENTRAL_FILE = 'words.central.csv';
const ALLOWED_MODES = Object.keys(MODE_FILES);
const DEFAULT_MODE = 'bgwp';

function parseCsv(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const records = csv.parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
  return records.map(w => ({ word: w.word.trim(), difficulty: w.difficulty.trim() }));
}

// Load words for a given mode: central list + mode-specific additions
function loadWords(mode) {
  if (!MODE_FILES[mode]) {
    throw new Error(`Unknown mode: ${mode}. Allowed: ${ALLOWED_MODES.join(', ')}`);
  }
  const central = parseCsv(path.join(__dirname, '../data', CENTRAL_FILE));
  const modeSpecific = parseCsv(path.join(__dirname, '../data', MODE_FILES[mode]));
  const words = [...central, ...modeSpecific];

  const easy = words.filter(w => w.difficulty === 'leicht').length;
  const medium = words.filter(w => w.difficulty === 'mittel').length;
  const hard = words.filter(w => w.difficulty === 'schwer').length;
  console.log(`[${mode}] Loaded ${words.length} words (central: ${central.length}, mode-specific: ${modeSpecific.length}, easy: ${easy}, medium: ${medium}, hard: ${hard})`);

  return words;
}

function createServer(wordsInput) {
  // Accept either a wordsByMode map { bgwp: [...], english: [...] }
  // or a legacy flat array (used by existing tests until Step 3 updates them)
  const wordsByMode = Array.isArray(wordsInput)
    ? { bgwp: wordsInput, english: wordsInput }
    : wordsInput;
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

  // Game duration in milliseconds (40 minutes)
  const GAME_DURATION_MS = 40 * 60 * 1000;

  // Create game
  function createGame(gameId, hostId, hostName, gridSize = '4x4', gameDuration = GAME_DURATION_MS, sameWords = false, mode = DEFAULT_MODE, toniKrank = false, leonFehlt = false) {
    const game = {
      id: gameId,
      hostId: hostId,
      hostName: hostName,
      gridSize: gridSize,
      sameWords: sameWords,
      mode: mode,
      toniKrank: toniKrank,
      leonFehlt: leonFehlt,
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

    socket.on('get-leaderboard', () => {
      socket.emit('leaderboard-updated', getLeaderboard());
    });

    // Host creates a game
    socket.on('create-game', (data) => {
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ';
      let gameId;
      do {
        gameId = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      } while (games.has(gameId));
      const gridSize = data.gridSize || '4x4';
      const gameDuration = Math.max(1, parseInt(data.gameDuration, 10) || 60) * 60 * 1000;
      const sameWords = data.sameWords !== undefined ? data.sameWords : false;
      const mode = ALLOWED_MODES.includes(data.mode) ? data.mode : DEFAULT_MODE;
      const toniKrank = data.toniKrank === true;
      const leonFehlt = data.leonFehlt === true;
      const game = createGame(gameId, socket.id, data.hostName, gridSize, gameDuration, sameWords, mode, toniKrank, leonFehlt);
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

      socket.emit('game-created', { gameId, game: { ...game, players: Array.from(game.players.values()), mode: game.mode } });
      io.to(gameId).emit('player-joined', {
        players: Array.from(game.players.values()),
        mode: game.mode
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
            })),
            mode: game.mode
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
        players: Array.from(game.players.values()),
        mode: game.mode
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

      // Resolve word pool for this game's mode (no filesystem I/O — all loaded at boot)
      let wordsList = wordsByMode[game.mode] || wordsByMode[DEFAULT_MODE];
      if (game.toniKrank) {
        wordsList = wordsList.filter(w => w.word !== 'Toni the tiger');
      }
      if (game.leonFehlt) {
        wordsList = wordsList.filter(w => w.word !== 'Leon (böse)');
      }

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
          const leaderboard = updateLeaderboard(scores);
          io.emit('leaderboard-updated', leaderboard);
        }
      }, game.gameDuration);

      console.log('Sending game-started with playerGrids:', Object.keys(playerGrids));
      io.to(gameId).emit('game-started', {
        playerGrids,
        gridSize,
        endTime: game.endTime,
        mode: game.mode
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
      const leaderboard = updateLeaderboard(scores);
      io.emit('leaderboard-updated', leaderboard);
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
        })),
        mode: game.mode
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
  console.log('Loading word lists...');
  const wordsByMode = {
    bgwp: loadWords('bgwp'),
    english: loadWords('english')
  };
  console.log(`Word lists ready — bgwp: ${wordsByMode.bgwp.length}, english: ${wordsByMode.english.length}`);
  const { httpServer } = createServer(wordsByMode);
  httpServer.listen(3001, '0.0.0.0', () => {
    console.log('Server running on port 3001');
  });
}

module.exports = { createServer, loadWords, ALLOWED_MODES, DEFAULT_MODE, MODE_FILES };
