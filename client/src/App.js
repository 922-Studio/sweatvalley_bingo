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
  const [winner, setWinner] = useState(null);
  const [roundInfo, setRoundInfo] = useState({ current: 0, max: 10 });

  // Socket connection
  useEffect(() => {
    const socketURL = process.env.NODE_ENV === 'production'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001';

    const newSocket = io(socketURL, {
      reconnectionDelay: 1000,
      reconnection: true,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
      agent: false,
      upgrade: false,
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
      console.log('game-started received:', data);
      console.log('Current socket id:', newSocket.id);
      console.log('Available grids:', Object.keys(data.playerGrids || {}));

      const gridSizeFromServer = data.gridSize || '4x4';
      const gridTotal = gridSizeFromServer === '3x3' ? 9 : 16;

      setScreen('in-game');
      setGameStatus('playing');
      setGridSize(gridSizeFromServer);
      setMarked(Array(gridTotal).fill(false));

      const currentPlayerGrid = data.playerGrids?.[newSocket.id];
      console.log('Current player grid:', currentPlayerGrid);

      if (currentPlayerGrid) {
        setGrid(currentPlayerGrid);
      } else {
        console.warn('No grid found for player!');
      }

      setBingos(0);
      setRoundInfo({ current: 1, max: 1 });
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

    newSocket.on('player-won', (data) => {
      setWinner({
        playerName: data.playerName,
        bingos: data.bingos
      });
    });

    newSocket.on('player-left', (data) => {
      setPlayers(data.players);
    });

    newSocket.on('round-finished', (data) => {
      const newScores = {};
      data.scores.forEach(s => {
        newScores[s.name] = s.score;
      });
      setScores(newScores);
      setRoundInfo({ current: data.nextRound, max: 10 });
      setMarked(Array(16).fill(false));
      setBingos(0);
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
      socket.emit('create-game', { hostName: playerName, gridSize });
    }
  };

  const handleJoinGame = () => {
    if (playerName.trim() && gameCode.trim()) {
      socket.emit('join-game', { gameId: gameCode, playerName });
      setGameId(gameCode);
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
    setPlayerName('');
    setPlayers([]);
    setMarked([]);
    setBingos(0);
    setWinner(null);
  };

  const handleEndRound = () => {
    socket.emit('end-round', { gameId });
  };

  const renderWelcomeScreen = () => (
    <div className="container">
      <div className="header">
        <h1>🎉 BINGO 🎉</h1>
        <p>Spielen Sie mit Freunden!</p>
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

  const renderInGameScreen = () => (
    <div className="container">
      <div className="header">
        <h1>🎉 BINGO 🎉</h1>
        <div className="round-info">
          Runde: {roundInfo.current} / {roundInfo.max}
        </div>
      </div>

      <div className="game-screen">
        <div className="game-area">
          <div className="game-status">
            Deine Bingos: {bingos}
            {bingos >= 1 && ' - GEWONNEN! 🎉'}
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
            <button className="btn-primary" onClick={handleEndRound}>
              Runde beenden
            </button>
          )}
        </div>

        <div className="sidebar">
          <div className="scoreboard">
            <h3>Bingos</h3>
            {players.map((player) => (
              <div key={player.id} className="score-item">
                <span className="score-name">{player.name}</span>
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

      {winner && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>🎉 Gewinner! 🎉</h2>
            <p>Herzlichen Glückwunsch!</p>
            <div className="winner-name">{winner.playerName}</div>
            <div className="score">{winner.bingos} Bingos</div>
            <div className="modal-buttons">
              <button className="btn-secondary" onClick={() => setWinner(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFinishedScreen = () => (
    <div className="container">
      <div className="header">
        <h1>🎉 SPIEL VORBEI 🎉</h1>
      </div>

      <div className="main-screen">
        <div className="scoreboard" style={{ maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          <h3>Finale Bingos</h3>
          {Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .map(([name, score], idx) => (
              <div key={idx} className="score-item">
                <span className="score-name">{idx + 1}. {name}</span>
                <span className="score-value">{score}</span>
              </div>
            ))}
        </div>

        <div className="button-group">
          <button className="btn-primary" onClick={handleLeaveGame}>
            Zurück zum Menü
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {screen === 'welcome' && renderWelcomeScreen()}
      {screen === 'game-setup' && renderGameSetupScreen()}
      {screen === 'in-game' && renderInGameScreen()}
      {gameStatus === 'finished' && renderFinishedScreen()}
    </>
  );
};

export default App;
