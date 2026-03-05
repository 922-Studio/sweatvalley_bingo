import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './index.css';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('welcome'); // welcome, game-setup, in-game
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [gridSize, setGridSize] = useState('4x4');
  const [players, setPlayers] = useState([]);
  const [grid, setGrid] = useState([]);
  const [marked, setMarked] = useState([]);
  const [bingos, setBingos] = useState(0);
  const [gameStatus, setGameStatus] = useState('waiting'); // waiting, playing, finished
  const [scores, setScores] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [gameDuration, setGameDuration] = useState('60');
  const [sameWords, setSameWords] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);
  const [endTime, setEndTime] = useState(null);

  // Countdown timer
  useEffect(() => {
    if (!endTime || gameStatus !== 'playing') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime, gameStatus]);

  // Socket connection
  useEffect(() => {
    const socketURL = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : 'http://localhost:3001';

    const newSocket = io(socketURL, {
      reconnectionDelay: 1000,
      reconnection: true,
      reconnectionAttempts: 10,
      transports: ['websocket'],
    });

    setSocket(newSocket);

    newSocket.on('game-created', (data) => {
      setGameId(data.gameId);
      setGameCode(data.gameId);
      setIsHost(true);
      setScreen('game-setup');
    });

    newSocket.on('player-joined', (data) => {
      setPlayers(data.players);
    });

    newSocket.on('game-started', (data) => {
      const gridSizeFromServer = data.gridSize || '4x4';
      const gridTotal = gridSizeFromServer === '3x3' ? 9 : 16;

      setScreen('in-game');
      setGameStatus('playing');
      setGridSize(gridSizeFromServer);
      setMarked(Array(gridTotal).fill(false));
      setEndTime(data.endTime);

      const currentPlayerGrid = data.playerGrids?.[newSocket.id];
      if (currentPlayerGrid) {
        setGrid(currentPlayerGrid);
      }

      setBingos(0);
    });

    newSocket.on('player-marked', (data) => {
      // Only update bingos from server (marked state is updated locally/optimistically)
      if (data.playerId === newSocket.id) {
        setBingos(data.score);
      }

      // Update other players' bingos in scoreboard
      setPlayers(prevPlayers =>
        prevPlayers.map(p =>
          p.id === data.playerId
            ? { ...p, score: data.score }
            : p
        )
      );
    });

    newSocket.on('player-left', (data) => {
      setPlayers(data.players);
    });

    newSocket.on('game-finished', (data) => {
      const newScores = {};
      data.scores.forEach(s => {
        newScores[s.name] = s.score;
      });
      setScores(newScores);
      setGameStatus('finished');
    });

    newSocket.on('error', (data) => {
      alert(data.message);
    });

    return () => newSocket.close();
  }, []);

  const handleCreateGame = () => {
    if (playerName.trim()) {
      const duration = Math.max(1, Math.min(180, parseInt(gameDuration, 10) || 60));
      socket.emit('create-game', { hostName: playerName, gridSize, gameDuration: duration, sameWords });
    }
  };

  const handleJoinGame = () => {
    if (playerName.trim() && gameCode.trim()) {
      const code = gameCode.trim().toUpperCase();
      socket.emit('join-game', { gameId: code, playerName });
      setGameId(code);
      setScreen('game-setup');
    }
  };

  const handleStartGame = () => {
    socket.emit('start-game', { gameId });
  };

  const handleMarkWord = (index) => {
    // Optimistic update - update UI immediately
    const newMarked = [...marked];
    newMarked[index] = !newMarked[index];
    setMarked(newMarked);

    // Then send to server
    socket.emit('mark-word', { gameId, index });
  };

  const handleLeaveGame = () => {
    socket.emit('leave-game', { gameId });
    setScreen('welcome');
    setGameStatus('waiting');
    setPlayerName('');
    setPlayers([]);
    setMarked([]);
    setBingos(0);
    setScores({});
    setEndTime(null);
    setTimeLeft(null);
  };

  const handleEndGame = () => {
    socket.emit('end-game', { gameId });
  };

  const renderWelcomeScreen = () => (
    <div className="container">
      <div className="header">
        <h1>🎉 BINGO 🎉</h1>
        <p>Schweisstal Edition</p>
      </div>

      <div className="main-screen">
        <div className="input-group">
          <label>Dein Name:</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Gib deinen Namen ein..."
            onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
          />
        </div>

        <div className="game-setup">
          <div className="setup-section">
            <h2>Neues Spiel erstellen</h2>
            <div className="input-group">
              <label>Grid-Größe:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={`btn-${gridSize === '3x3' ? 'primary' : 'secondary'}`}
                  onClick={() => setGridSize('3x3')}
                  style={{ flex: 1 }}
                >
                  3x3
                </button>
                <button
                  className={`btn-${gridSize === '4x4' ? 'primary' : 'secondary'}`}
                  onClick={() => setGridSize('4x4')}
                  style={{ flex: 1 }}
                >
                  4x4
                </button>
              </div>
            </div>
            <div className="input-group">
              <label>Spieldauer (Minuten):</label>
              <input
                type="number"
                min="1"
                max="180"
                value={gameDuration}
                onChange={(e) => setGameDuration(e.target.value)}
                style={{ width: '80px' }}
              />
            </div>
            <div className="input-group">
              <label>Begriffe:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={`btn-${sameWords ? 'primary' : 'secondary'}`}
                  onClick={() => setSameWords(true)}
                  style={{ flex: 1 }}
                >
                  Gleich
                </button>
                <button
                  className={`btn-${!sameWords ? 'primary' : 'secondary'}`}
                  onClick={() => setSameWords(false)}
                  style={{ flex: 1 }}
                >
                  Verschieden
                </button>
              </div>
              <p style={{ color: '#999', fontSize: '0.8em', margin: 0 }}>
                {sameWords
                  ? 'Alle Spieler sehen die gleichen Begriffe'
                  : 'Verschiedene Begriffe, gleiche Schwierigkeiten'}
              </p>
            </div>
            <button className="btn-primary" onClick={handleCreateGame}>
              Spiel erstellen
            </button>
            <p style={{ color: '#999', fontSize: '0.9em', textAlign: 'center' }}>
              Du wirst zum Host des Spiels
            </p>
          </div>

          <div className="setup-section">
            <h2>Spiel beitreten</h2>
            <div className="input-group">
              <label>Spiel-Code:</label>
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                placeholder="Gib den Spiel-Code ein..."
                onKeyPress={(e) => e.key === 'Enter' && handleJoinGame()}
              />
            </div>
            <button className="btn-secondary" onClick={handleJoinGame}>
              Beitreten
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGameSetupScreen = () => (
    <div className="container">
      <div className="header">
        <h1>🎉 BINGO 🎉</h1>
        <p>Spiel vorbereitung</p>
      </div>

      <div className="main-screen">
        <div className="game-info">
          <div className="game-id">
            Spiel-Code: <strong>{gameId}</strong>
          </div>
          <p style={{ color: '#666', marginTop: '10px', fontSize: '0.9em' }}>
            Teile diesen Code mit deinen Freunden, um beizutreten
          </p>
        </div>

        <div className="player-list">
          <h3>Spieler ({players.length})</h3>
          {players.map((player) => (
            <div key={player.id} className="player-item">
              <span className="player-name">{player.name}</span>
              {player.id === socket?.id && (
                <span className="player-host">HOST</span>
              )}
            </div>
          ))}
        </div>

        <div className="button-group">
          {isHost && players.length > 0 && (
            <button className="btn-primary" onClick={handleStartGame}>
              Spiel starten
            </button>
          )}
          <button className="btn-danger" onClick={handleLeaveGame}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );

  const formatTime = (ms) => {
    if (ms == null) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const renderInGameScreen = () => {
    const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

    return (
      <div className="container">
        <div className="header">
          <h1>BINGO</h1>
          <div className="timer-display">
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="game-screen">
          <div className="game-area">
            <div className="game-status">
              Deine Bingos: {bingos}
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${gridSize === '3x3' ? 3 : 4}, 1fr)`
              }}
            >
              {grid.map((row, rowIdx) =>
                row.map((word, colIdx) => {
                  const size = gridSize === '3x3' ? 3 : 4;
                  const index = rowIdx * size + colIdx;
                  return (
                    <button
                      key={index}
                      className={`cell ${marked[index] ? 'marked' : ''}`}
                      onClick={() => handleMarkWord(index)}
                    >
                      {word.word}
                    </button>
                  );
                })
              )}
            </div>

            {gameStatus === 'playing' && isHost && (
              <button className="btn-danger" onClick={handleEndGame}>
                Spiel beenden
              </button>
            )}
          </div>

          <div className="sidebar">
            <div className="scoreboard">
              <h3>Leaderboard</h3>
              {sortedPlayers.map((player, idx) => (
                <div key={player.id} className={`score-item ${idx === 0 && (player.score || 0) > 0 ? 'leader' : ''}`}>
                  <span className="score-name">{idx + 1}. {player.name}</span>
                  <span className="score-value">{player.score || 0}</span>
                </div>
              ))}
            </div>

            <div className="controls">
              <button className="btn-danger" onClick={handleLeaveGame}>
                Spiel verlassen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFinishedScreen = () => {
    const trophies = ['🏆', '🥈', '🥉'];
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

    return (
      <div className="container">
        <div className="header">
          <h1>SPIEL VORBEI</h1>
        </div>

        <div className="main-screen">
          <div className="podium">
            {sorted.slice(0, 3).map(([name, score], idx) => (
              <div key={idx} className={`podium-place podium-${idx + 1}`}>
                <div className="podium-trophy">{trophies[idx]}</div>
                <div className="podium-name">{name}</div>
                <div className="podium-score">{score} Bingos</div>
              </div>
            ))}
          </div>

          {sorted.length > 3 && (
            <div className="scoreboard" style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
              {sorted.slice(3).map(([name, score], idx) => (
                <div key={idx} className="score-item">
                  <span className="score-name">{idx + 4}. {name}</span>
                  <span className="score-value">{score}</span>
                </div>
              ))}
            </div>
          )}

          <div className="button-group">
            <button className="btn-primary" onClick={handleLeaveGame}>
              Zurück zum Menü
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {screen === 'welcome' && renderWelcomeScreen()}
      {screen === 'game-setup' && renderGameSetupScreen()}
      {screen === 'in-game' && renderInGameScreen()}
      {gameStatus === 'finished' && renderFinishedScreen()}
      <footer className="site-footer">
        <span>&copy; {new Date().getFullYear()} 922 Studio</span>
        <span className="footer-separator">|</span>
        <a href="https://gregor.922-studio.com/de/impressum" target="_blank" rel="noopener noreferrer">Impressum</a>
        <span className="footer-separator">|</span>
        <span>Developed by Leo</span>
      </footer>
    </>
  );
};

export default App;
