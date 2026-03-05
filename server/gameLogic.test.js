const { generateGrid, checkForLines, createPlayerGrid } = require('./gameLogic');

describe('checkForLines', () => {
  it('detects a horizontal line in 4x4', () => {
    const marked = Array(16).fill(false);
    // Mark first row: indices 0,1,2,3
    marked[0] = marked[1] = marked[2] = marked[3] = true;
    expect(checkForLines(marked, '4x4')).toBe(1);
  });

  it('detects a vertical line in 4x4', () => {
    const marked = Array(16).fill(false);
    // Mark first column: indices 0,4,8,12
    marked[0] = marked[4] = marked[8] = marked[12] = true;
    expect(checkForLines(marked, '4x4')).toBe(1);
  });

  it('detects diagonal in 3x3', () => {
    const marked = Array(9).fill(false);
    // Main diagonal: 0, 4, 8
    marked[0] = marked[4] = marked[8] = true;
    expect(checkForLines(marked, '3x3')).toBe(1);
  });

  it('returns 0 when no lines complete', () => {
    const marked = Array(16).fill(false);
    marked[0] = true;
    expect(checkForLines(marked, '4x4')).toBe(0);
  });

  it('counts all lines when all marked in 3x3', () => {
    // All marked = 3 rows + 3 cols + 2 diagonals = 8
    const marked = Array(9).fill(true);
    expect(checkForLines(marked, '3x3')).toBe(8);
  });
});

describe('generateGrid', () => {
  const testWords = [
    ...Array(14).fill(null).map((_, i) => ({ word: `easy${i}`, difficulty: 'leicht' })),
    { word: 'med1', difficulty: 'mittel' },
    { word: 'hard1', difficulty: 'schwer' },
  ];

  it('returns 16 words for 4x4', () => {
    const grid = generateGrid(testWords, '4x4');
    expect(grid).toHaveLength(16);
  });

  it('returns 9 words for 3x3', () => {
    const grid = generateGrid(testWords, '3x3');
    expect(grid).toHaveLength(9);
  });

  it('does not mutate input array', () => {
    const before = JSON.stringify(testWords);
    generateGrid(testWords, '4x4');
    expect(JSON.stringify(testWords)).toBe(before);
  });
});

describe('createPlayerGrid', () => {
  it('creates correct 2D array from flat word list for 4x4', () => {
    const words = Array(16).fill(null).map((_, i) => ({ word: `w${i}` }));
    const grid = createPlayerGrid(words, '4x4');
    expect(grid).toHaveLength(4);
    expect(grid[0]).toHaveLength(4);
    expect(grid[0][0]).toEqual({ word: 'w0' });
    expect(grid[3][3]).toEqual({ word: 'w15' });
  });

  it('creates correct 2D array for 3x3', () => {
    const words = Array(9).fill(null).map((_, i) => ({ word: `w${i}` }));
    const grid = createPlayerGrid(words, '3x3');
    expect(grid).toHaveLength(3);
    expect(grid[0]).toHaveLength(3);
  });
});
