const fs = require('fs');
const path = require('path');

const STATE_DIR = path.join(__dirname, '../state');
const LEADERBOARD_PATH = path.join(STATE_DIR, 'leaderboard.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(LEADERBOARD_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function save(data) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Update leaderboard with end-of-game scores.
// scores: [{ name, score }]
// Returns the updated sorted leaderboard array.
function updateLeaderboard(scores) {
  const data = load();
  for (const { name, score } of scores) {
    if (!name) continue;
    const entry = data[name] || { totalScore: 0, highestRound: 0, gamesPlayed: 0 };
    entry.totalScore += score;
    entry.highestRound = Math.max(entry.highestRound, score);
    entry.gamesPlayed += 1;
    data[name] = entry;
  }
  save(data);
  return getLeaderboard(data);
}

// Returns sorted leaderboard array: [{ name, totalScore, highestRound, gamesPlayed }]
function getLeaderboard(data) {
  const entries = data || load();
  return Object.entries(entries)
    .map(([name, e]) => ({ name, totalScore: e.totalScore, highestRound: e.highestRound, gamesPlayed: e.gamesPlayed }))
    .sort((a, b) => b.totalScore - a.totalScore || b.highestRound - a.highestRound);
}

module.exports = { updateLeaderboard, getLeaderboard };
