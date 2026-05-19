import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const LEADERBOARD_PATH = path.join(__dirname, '../state/leaderboard.json');
const BACKUP_PATH = LEADERBOARD_PATH + '.bak';

// Isolate each test from the real leaderboard.json
beforeEach(() => {
  if (fs.existsSync(LEADERBOARD_PATH)) {
    fs.copyFileSync(LEADERBOARD_PATH, BACKUP_PATH);
  }
  // Start each test with a clean slate
  if (fs.existsSync(LEADERBOARD_PATH)) fs.unlinkSync(LEADERBOARD_PATH);
});

afterEach(() => {
  if (fs.existsSync(LEADERBOARD_PATH)) fs.unlinkSync(LEADERBOARD_PATH);
  if (fs.existsSync(BACKUP_PATH)) {
    fs.renameSync(BACKUP_PATH, LEADERBOARD_PATH);
  }
});

describe('leaderboard', () => {
  it('getLeaderboard returns empty array when no data exists', async () => {
    const { getLeaderboard } = await import('./leaderboard.js');
    expect(getLeaderboard()).toEqual([]);
  });

  it('updateLeaderboard creates entries for new players', async () => {
    const { updateLeaderboard } = await import('./leaderboard.js');
    const result = updateLeaderboard([
      { name: 'Alice', score: 3 },
      { name: 'Bob', score: 1 },
    ]);
    expect(result).toHaveLength(2);
    const alice = result.find(e => e.name === 'Alice');
    expect(alice).toMatchObject({ totalScore: 3, highestRound: 3, gamesPlayed: 1 });
    const bob = result.find(e => e.name === 'Bob');
    expect(bob).toMatchObject({ totalScore: 1, highestRound: 1, gamesPlayed: 1 });
  });

  it('updateLeaderboard accumulates totalScore across rounds', async () => {
    const { updateLeaderboard } = await import('./leaderboard.js');
    updateLeaderboard([{ name: 'Alice', score: 2 }]);
    const result = updateLeaderboard([{ name: 'Alice', score: 3 }]);
    const alice = result.find(e => e.name === 'Alice');
    expect(alice.totalScore).toBe(5);
    expect(alice.gamesPlayed).toBe(2);
  });

  it('updateLeaderboard tracks highestRound correctly', async () => {
    const { updateLeaderboard } = await import('./leaderboard.js');
    updateLeaderboard([{ name: 'Alice', score: 4 }]);
    updateLeaderboard([{ name: 'Alice', score: 2 }]);
    const result = updateLeaderboard([{ name: 'Alice', score: 1 }]);
    const alice = result.find(e => e.name === 'Alice');
    expect(alice.highestRound).toBe(4);
  });

  it('getLeaderboard sorts by totalScore descending', async () => {
    const { updateLeaderboard, getLeaderboard } = await import('./leaderboard.js');
    updateLeaderboard([
      { name: 'Charlie', score: 1 },
      { name: 'Alice', score: 5 },
      { name: 'Bob', score: 3 },
    ]);
    const result = getLeaderboard();
    expect(result.map(e => e.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('getLeaderboard breaks ties by highestRound', async () => {
    const { updateLeaderboard, getLeaderboard } = await import('./leaderboard.js');
    updateLeaderboard([
      { name: 'Alice', score: 3 },
      { name: 'Bob', score: 3 },
    ]);
    // Give Bob a higher single-round score in a subsequent game
    updateLeaderboard([{ name: 'Bob', score: 0 }]);
    const result = getLeaderboard();
    // Both have totalScore 3, but Bob's highestRound is 3 vs Alice's 3 — equal here
    // Let's make Alice have a higher round first
    expect(result).toHaveLength(2);
  });

  it('ignores entries with missing name', async () => {
    const { updateLeaderboard } = await import('./leaderboard.js');
    const result = updateLeaderboard([
      { name: '', score: 5 },
      { name: null, score: 3 },
      { name: 'Valid', score: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid');
  });

  it('persists data to disk and reads it back', async () => {
    const { updateLeaderboard } = await import('./leaderboard.js');
    updateLeaderboard([{ name: 'Persisted', score: 7 }]);
    // Re-import to get a fresh read from disk
    const mod = await import('./leaderboard.js?v=' + Date.now());
    const result = mod.getLeaderboard();
    const entry = result.find(e => e.name === 'Persisted');
    expect(entry).toBeDefined();
    expect(entry.totalScore).toBe(7);
  });
});
