// The screenshot scenes behind ?shot=title|play|boss|victory. Each one stages
// a real game state with the game's own rules — the play scene by steering a
// simple autopilot forward from a fresh run, the boss and victory scenes by
// building the state a run reaches there — and the renderer paints it, so
// every screenshot is a real render of this code, never edited or composited.
import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { createRandom } from './random.js';
import { spawnEnemy } from './enemies.js';
import { startWave } from './waves.js';
import { maxHpOf } from './player.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

/** Fixed ambient time for every shot, so the water and light never differ. */
export const SHOT_TIME = 12.0;
/** Seconds the play scene's autopilot runs before the frame is taken. */
const PLAY_SECONDS = 30;
/** Seconds the boss scene runs after the Maw arrives. */
const BOSS_SECONDS = 6;

/** Steer away from close enemies, toward pearls when safe, off the edges. */
function autopilot(state) {
  const player = state.player;
  let x = 0;
  let y = 0;
  let near = 0;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < 240) {
      const weight = (240 - distance) / 240;
      x += (dx / distance) * weight;
      y += (dy / distance) * weight;
      near += 1;
    }
  }
  if (near === 0) {
    let pearl = null;
    let best = 340;
    for (const pickup of state.pickups) {
      if (pickup.kind !== 'pearl') continue;
      const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (distance < best) {
        best = distance;
        pearl = pickup;
      }
    }
    if (pearl) {
      x += (pearl.x - player.x) / (best || 1);
      y += (pearl.y - player.y) / (best || 1);
    }
  }
  // Keep off the walls.
  const margin = 130;
  if (player.x < margin) x += 1;
  if (player.x > FIELD.width - margin) x -= 1;
  if (player.y < margin) y += 1;
  if (player.y > FIELD.height - margin) y -= 1;
  const length = Math.hypot(x, y);
  const burst = near >= 4 && player.burstTimer <= 0;
  if (length < 0.01) return { direction: { x: 0, y: 0 }, burst };
  return { direction: { x: x / length, y: y / length }, burst };
}

/** Run the world forward with the autopilot, spending level-ups as they come. */
function playForward(state, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.over || state.won) break;
    const { direction, burst } = autopilot(state);
    stepWorld(state, STEP, direction, burst);
    while (state.pendingLevels > 0) {
      const choices = state.upgrades.roll(state.random);
      if (choices.length === 0) break;
      state.upgrades.apply(choices[0].id);
      state.pendingLevels -= 1;
    }
  }
}

/** A mid-run player: levelled, upgraded, and healthy. */
function equipMidRunPlayer(state, level) {
  const picks = ['damage', 'damage', 'rate', 'rate', 'multishot', 'shells', 'shells', 'vitality', 'vitality', 'speed', 'magnet', 'pierce'];
  for (const id of picks) state.upgrades.apply(id);
  state.player.level = level;
  state.player.hp = maxHpOf(state.player);
}

/**
 * Stage the named scene and return the screen to draw and the UI the screen
 * needs. Any unknown name stages the title.
 */
export function stageShot(name, seed) {
  const random = createRandom(seed);
  if (name === 'play') {
    const state = createWorld(random, 'storm');
    playForward(state, PLAY_SECONDS);
    state.shake = 0;
    return { state, screen: SCREEN_PLAY, ui: null, time: SHOT_TIME };
  }
  if (name === 'boss') {
    const state = createWorld(random, 'storm');
    equipMidRunPlayer(state, 9);
    state.score = 4200;
    state.kills = 178;
    state.runTime = 282;
    startWave(state.waves, 10);
    state.waves.queue = [];
    const maw = spawnEnemy('maw', FIELD.width / 2, 170, 10, state.difficulty, random);
    maw.hp = Math.round(maw.maxHp * 0.72);
    state.enemies.push(maw);
    state.waves.bossSpawned = true;
    state.waves.boss = maw;
    for (const [x, y] of [[220, 520], [1050, 480], [320, 180], [980, 200]]) {
      state.enemies.push(spawnEnemy('wisp', x, y, 10, state.difficulty, random));
    }
    state.enemies.push(spawnEnemy('spitter', 180, 340, 10, state.difficulty, random));
    state.enemies.push(spawnEnemy('brute', 1100, 360, 10, state.difficulty, random));
    playForward(state, BOSS_SECONDS);
    state.shake = 0;
    return { state, screen: SCREEN_PLAY, ui: null, time: SHOT_TIME };
  }
  if (name === 'victory') {
    const state = createWorld(random, 'storm');
    equipMidRunPlayer(state, 12);
    state.score = 18400;
    state.kills = 342;
    state.runTime = 362;
    state.player.hp = Math.round(maxHpOf(state.player) * 0.62);
    state.won = true;
    state.waves.wave = 10;
    state.shake = 0;
    return { state, screen: SCREEN_VICTORY, ui: null, time: SHOT_TIME };
  }
  const state = createWorld(random, 'storm');
  state.shake = 0;
  return {
    state,
    screen: SCREEN_TITLE,
    ui: {
      difficultyIndex: 1,
      best: { score: 0, wave: 0, kills: 0 },
      wins: { calm: 0, storm: 0, abyss: 0 },
      muted: false,
      startSelected: true,
    },
    time: SHOT_TIME,
  };
}
