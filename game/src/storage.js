// Saved progress: the best score and wave, and which difficulties the player
// has beaten. localStorage can be off (private windows), so every call is
// guarded and a failure just means this visit only.
import { BEST_KEY, WINS_KEY } from './config.js';

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage off: the bests last this visit only.
  }
}

export function readBest() {
  return readJson(BEST_KEY, { score: 0, wave: 0, kills: 0 });
}

export function saveBest(best) {
  writeJson(BEST_KEY, best);
}

/** Wins per difficulty id, e.g. { calm: 1, storm: 0, abyss: 0 }. */
export function readWins() {
  return readJson(WINS_KEY, { calm: 0, storm: 0, abyss: 0 });
}

export function saveWins(wins) {
  writeJson(WINS_KEY, wins);
}
