// Pure game logic functions extracted from server.js

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

// Check if a player has a complete line (horizontal, vertical, diagonal)
function checkForLines(marked, gridSize = '4x4') {
  let lineCount = 0;
  const size = gridSize === '3x3' ? 3 : 4;

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

// Generate grid for a player (flat word list -> 2D array)
function createPlayerGrid(playerWords, gridSize = '4x4') {
  const grid = [];
  const size = gridSize === '3x3' ? 3 : 4;
  for (let i = 0; i < size; i++) {
    grid.push(playerWords.slice(i * size, (i + 1) * size));
  }
  return grid;
}

module.exports = { generateGrid, checkForLines, createPlayerGrid };
