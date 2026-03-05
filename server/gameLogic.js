// Pure game logic functions extracted from server.js

// Generate random grid with fixed word distribution
function generateGrid(allWords, gridSize = '4x4') {
  const easy = allWords.filter(w => w.difficulty === 'leicht');
  const medium = allWords.filter(w => w.difficulty === 'mittel');
  const hard = allWords.filter(w => w.difficulty === 'schwer');

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  const total = gridSize === '3x3' ? 9 : 16;

  // Combine all words shuffled, then pick the required amount
  const allShuffled = shuffle([...easy, ...medium, ...hard]);

  // Ensure at least 1 hard and 1 medium if available
  let selected = [];
  const shuffledHard = shuffle(hard);
  const shuffledMedium = shuffle(medium);
  const shuffledEasy = shuffle(easy);

  if (shuffledHard.length > 0) selected.push(shuffledHard[0]);
  if (shuffledMedium.length > 0) selected.push(shuffledMedium[0]);

  // Fill remaining from all words (excluding already selected)
  const selectedWords = new Set(selected.map(w => w.word));
  const remaining = allShuffled.filter(w => !selectedWords.has(w.word));
  selected = [...selected, ...remaining.slice(0, total - selected.length)];

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
