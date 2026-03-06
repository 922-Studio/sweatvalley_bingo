// Pure game logic functions extracted from server.js

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

// Generate a difficulty layout (array of difficulty strings for each cell)
// TODO: 4x4 should be mostly easy — max 1 hard + 1 medium per row
function generateDifficultyLayout(allWords, gridSize = '4x4') {
  const total = gridSize === '3x3' ? 9 : 16;
  const easyCount = allWords.filter(w => w.difficulty === 'leicht').length;
  const mediumCount = allWords.filter(w => w.difficulty === 'mittel').length;
  const hardCount = allWords.filter(w => w.difficulty === 'schwer').length;

  // Build pool of difficulties proportional to available words
  const pool = [
    ...Array(easyCount).fill('leicht'),
    ...Array(mediumCount).fill('mittel'),
    ...Array(hardCount).fill('schwer')
  ];

  let layout = [];
  // Ensure at least 1 hard and 1 medium if available
  if (hardCount > 0) layout.push('schwer');
  if (mediumCount > 0) layout.push('mittel');

  // Fill rest from shuffled pool (excluding already picked guaranteed slots)
  const shuffledPool = shuffle(pool);
  for (const d of shuffledPool) {
    if (layout.length >= total) break;
    layout.push(d);
  }

  return shuffle(layout.slice(0, total));
}

// Generate a grid of words matching a given difficulty layout
function generateGridFromLayout(allWords, layout) {
  const wordsByDifficulty = {
    leicht: shuffle(allWords.filter(w => w.difficulty === 'leicht')),
    mittel: shuffle(allWords.filter(w => w.difficulty === 'mittel')),
    schwer: shuffle(allWords.filter(w => w.difficulty === 'schwer'))
  };

  const counters = { leicht: 0, mittel: 0, schwer: 0 };
  return layout.map(difficulty => {
    const words = wordsByDifficulty[difficulty];
    if (counters[difficulty] < words.length) {
      return words[counters[difficulty]++];
    }
    // Fallback: pick from any available pool
    for (const d of ['leicht', 'mittel', 'schwer']) {
      if (counters[d] < wordsByDifficulty[d].length) {
        return wordsByDifficulty[d][counters[d]++];
      }
    }
    return { word: '???', difficulty };
  });
}

// Generate random grid with fixed word distribution (legacy, used for same-words mode)
function generateGrid(allWords, gridSize = '4x4') {
  const layout = generateDifficultyLayout(allWords, gridSize);
  return generateGridFromLayout(allWords, layout);
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

module.exports = { generateGrid, generateDifficultyLayout, generateGridFromLayout, checkForLines, createPlayerGrid };
