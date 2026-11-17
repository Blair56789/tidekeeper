// The world: everything that changes during a run, advanced one fixed step at
// a time. It owns the player, the enemies, the shots, the pickups, the wave
// director and the particles, and reports what happened as event flags so the
// loop can play sounds and switch screens.
import {
  BURST, DIFFICULTIES, HEART_DROP_BOSS, HEART_DROP_BRUTE, HEART_HEAL,
  KILL_SCORE, STEP, WAVE_BONUS, WAVE_CLEAR_HEAL, WAVES,
} from './config.js';
import { createParticles } from './particles.js';
import { createPlayer, stepPlayer, fireBurst, burstStats, addPearls, shellPositions, hurtPlayer, healPlayer, pickupRadiusOf, pearlMagnetSpeed, maxHpOf } from './player.js';
import { createUpgrades } from './upgrades.js';
import { damageEnemy, spawnEnemy, spawnPoint, stepEnemy } from './enemies.js';
import { createProjectiles, stepProjectiles, clearProjectiles } from './projectiles.js';
import { createPickups, dropPickup, stepPickups } from './pickups.js';
import { createWaves, startWave, stepWaves, remainingCount, totalWaves } from './waves.js';

export const EVENT_HIT = 1 << 0;
export const EVENT_KILL = 1 << 1;
export const EVENT_BOSS_KILL = 1 << 2;
export const EVENT_LEVELUP = 1 << 3;
export const EVENT_WAVE_CLEAR = 1 << 4;
export const EVENT_WAVE_START = 1 << 5;
export const EVENT_BOSS_SPAWN = 1 << 6;
export const EVENT_WIN = 1 << 7;
export const EVENT_OVER = 1 << 8;
export const EVENT_PICKUP = 1 << 9;
export const EVENT_HEART = 1 << 10;
export const EVENT_BURST = 1 << 11;
export const EVENT_SHOOT = 1 << 12;

export function createWorld(random, difficultyId = 'storm') {
  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId) ?? DIFFICULTIES[1];
  const upgrades = createUpgrades();
  const state = {
    random,
    difficulty,
    player: createPlayer(upgrades),
    upgrades,
    enemies: [],
    projectiles: createProjectiles(),
    pickups: createPickups(),
    waves: createWaves(),
    particles: createParticles(random),
    score: 0,
    kills: 0,
    time: 0,
    shake: 0,
    won: false,
    over: false,
    /** Levels gained and not yet spent on upgrades. */
    pendingLevels: 0,
    /** True while the breather between waves runs. */
    betweenWaves: false,
    /** Seconds since the run started, for the victory screen. */
    runTime: 0,
    ambientTimer: 0,
  };
  startWave(state.waves, 1);
  return state;
}

/** The final score, with the difficulty multiplier applied. */
export function finalScore(state) {
  return Math.round(state.score * state.difficulty.score);
}

/** Stars for the victory screen: 1 for winning, +1 with over half health, +1 on Abyss or a fast run. */
export function victoryStars(state) {
  let stars = 1;
  if (state.player.hp > maxHpOf(state.player) * 0.5) stars += 1;
  if (state.difficulty.id === 'abyss' || state.runTime < 420) stars += 1;
  return stars;
}

function killEnemy(state, enemy) {
  state.kills += 1;
  state.score += KILL_SCORE * enemy.score * state.waves.wave;
  state.particles.burst(enemy.x, enemy.y, enemy.glow, enemy.radius > 30 ? 26 : 12, enemy.radius > 30 ? 260 : 170);
  state.particles.bubbles(enemy.x, enemy.y, 3);
  for (let i = 0; i < enemy.pearls; i += 1) {
    dropPickup(state.pickups, 'pearl', enemy.x, enemy.y, 1, state.random);
  }
  const heartChance = enemy.kind === 'leviathan' || enemy.kind === 'maw'
    ? HEART_DROP_BOSS
    : enemy.kind === 'brute' ? HEART_DROP_BRUTE : 0;
  if (heartChance > 0 && state.random.next() < heartChance) {
    dropPickup(state.pickups, 'heart', enemy.x, enemy.y, HEART_HEAL, state.random);
  }
  // Splitters burst into small wisps.
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const child = spawnEnemy('wisp', enemy.x + (i === 0 ? -14 : 14), enemy.y, state.waves.wave, state.difficulty, state.random);
      child.radius = 10;
      child.hp = 8;
      child.maxHp = 8;
      state.enemies.push(child);
    }
  }
  if (enemy.kind === 'maw') {
    state.won = true;
    state.score += 1000;
  }
}

/**
 * Advance the world one fixed step. `direction` is the movement vector,
 * `burst` fires the Tidal Burst when true. Returns the event flags.
 */
export function stepWorld(state, dt, direction, burst) {
  let events = 0;
  if (state.over || state.won) return events;
  state.time += dt;
  state.runTime += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

  // Ambient bubbles drift up through the arena.
  state.ambientTimer -= dt;
  if (state.ambientTimer <= 0) {
    state.ambientTimer = 0.5;
    state.particles.bubbles(state.random.range(40, 1240), 730, 1);
  }

  // Player: move, auto-fire, burst.
  const bolts = stepPlayer(state.player, dt, direction, state.enemies, state.random);
  state.projectiles.bolts.push(...bolts);
  if (state.player.fired) events |= EVENT_SHOOT;
  if (burst && fireBurst(state.player)) {
    events |= EVENT_BURST;
    const stats = burstStats(state.player);
    state.particles.ring(state.player.x, state.player.y, '#7fe7ff', stats.radius);
    state.shake = Math.min(14, state.shake + 7);
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance < stats.radius + enemy.radius) {
        const died = damageEnemy(enemy, stats.damage, dx / distance, dy / distance);
        state.particles.floatText(enemy.x, enemy.y - enemy.radius, String(Math.round(stats.damage)), '#7fe7ff', 15);
        if (died) {
          events |= enemy.kind === 'maw' || enemy.kind === 'leviathan' ? EVENT_BOSS_KILL : EVENT_KILL;
          killEnemy(state, enemy);
        }
      }
    }
  }

  // Waves: spawning, boss arrival, wave clear.
  const waveResult = stepWaves(state.waves, dt, state.enemies, state.player, state.difficulty, state.random);
  if (waveResult === 'boss') {
    events |= EVENT_BOSS_SPAWN;
    state.shake = Math.min(16, state.shake + 8);
  } else if (waveResult === 'clear') {
    const cleared = state.waves.wave;
    state.score += WAVE_BONUS * cleared;
    healPlayer(state.player, WAVE_CLEAR_HEAL);
    events |= EVENT_WAVE_CLEAR;
    if (cleared < totalWaves()) {
      state.betweenWaves = true;
      state.waves.restTimer = 2.5;
    }
  }
  if (state.betweenWaves && state.waves.restTimer <= 0) {
    state.betweenWaves = false;
    startWave(state.waves, state.waves.wave + 1);
    events |= EVENT_WAVE_START;
  }

  // Enemies: move, shoot, summon.
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    for (const [key, value] of enemy.shellCooldowns) {
      if (value - dt <= 0) enemy.shellCooldowns.delete(key);
      else enemy.shellCooldowns.set(key, value - dt);
    }
    const shots = stepEnemy(enemy, dt, state.player, state.random);
    for (const shot of shots) {
      if (shot.kind === 'summon') {
        const child = spawnEnemy(shot.spawn, shot.x, shot.y, state.waves.wave, state.difficulty, state.random);
        state.enemies.push(child);
      } else {
        state.projectiles.blobs.push(shot);
      }
    }
  }

  stepProjectiles(state.projectiles, dt);

  // Bolts vs enemies.
  for (const bolt of state.projectiles.bolts) {
    for (const enemy of state.enemies) {
      if (!enemy.alive || bolt.hitIds.has(enemy.id)) continue;
      const dx = enemy.x - bolt.x;
      const dy = enemy.y - bolt.y;
      if (dx * dx + dy * dy < (enemy.radius + bolt.radius) * (enemy.radius + bolt.radius)) {
        bolt.hitIds.add(enemy.id);
        const died = damageEnemy(enemy, bolt.damage, bolt.vx / 540, bolt.vy / 540);
        state.particles.floatText(
          enemy.x, enemy.y - enemy.radius - 4,
          String(Math.round(bolt.damage)),
          bolt.critical ? '#ffd166' : '#ffffff',
          bolt.critical ? 18 : 14,
        );
        state.particles.burst(bolt.x, bolt.y, '#ffd166', 3, 90);
        if (bolt.pierce > 0) bolt.pierce -= 1;
        else bolt.life = 0;
        if (died) {
          events |= enemy.kind === 'maw' || enemy.kind === 'leviathan' ? EVENT_BOSS_KILL : EVENT_KILL;
          killEnemy(state, enemy);
        }
        break;
      }
    }
  }

  // Orbiting shells vs enemies.
  const shells = shellPositions(state.player);
  shells.forEach((shell, index) => {
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      if ((enemy.shellCooldowns.get(index) ?? 0) > 0) continue;
      const dx = enemy.x - shell.x;
      const dy = enemy.y - shell.y;
      if (dx * dx + dy * dy < (enemy.radius + shell.radius) * (enemy.radius + shell.radius)) {
        enemy.shellCooldowns.set(index, 0.45);
        const died = damageEnemy(enemy, shell.damage, dx / (Math.hypot(dx, dy) || 1), dy / (Math.hypot(dx, dy) || 1));
        state.particles.burst(shell.x, shell.y, '#ffb3d9', 4, 110);
        if (died) {
          events |= enemy.kind === 'maw' || enemy.kind === 'leviathan' ? EVENT_BOSS_KILL : EVENT_KILL;
          killEnemy(state, enemy);
        }
      }
    }
  });

  // Remove the dead.
  state.enemies = state.enemies.filter((enemy) => enemy.alive);

  // Enemy blobs vs the player.
  for (const blob of state.projectiles.blobs) {
    const dx = state.player.x - blob.x;
    const dy = state.player.y - blob.y;
    if (dx * dx + dy * dy < (state.player.radius + blob.radius) * (state.player.radius + blob.radius)) {
      blob.life = 0;
      const taken = hurtPlayer(state.player, blob.damage);
      if (taken > 0) {
        events |= EVENT_HIT;
        state.shake = Math.min(14, state.shake + 6);
        state.particles.burst(state.player.x, state.player.y, '#ff5d73', 8, 140);
      }
    }
  }

  // Contact with enemies.
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < state.player.radius + enemy.radius - 2) {
      const taken = hurtPlayer(state.player, enemy.damage);
      if (taken > 0) {
        events |= EVENT_HIT;
        state.shake = Math.min(14, state.shake + 6);
        state.particles.burst(state.player.x, state.player.y, '#ff5d73', 8, 140);
      }
      // Push the enemy back a little so it does not sit on the player.
      enemy.x -= (dx / distance) * 26;
      enemy.y -= (dy / distance) * 26;
    }
  }

  // Pickups.
  const collected = stepPickups(
    state.pickups, dt, state.player,
    pickupRadiusOf(state.player), pearlMagnetSpeed(),
  );
  for (const pickup of collected) {
    if (pickup.kind === 'pearl') {
      events |= EVENT_PICKUP;
      const gained = addPearls(state.player, pickup.value);
      if (gained > 0) {
        state.pendingLevels += gained;
        events |= EVENT_LEVELUP;
      }
    } else if (pickup.kind === 'heart') {
      const healed = healPlayer(state.player, pickup.value);
      if (healed > 0) {
        events |= EVENT_HEART;
        state.particles.floatText(state.player.x, state.player.y - 26, `+${healed}`, '#7dffa8', 16);
        state.particles.bubbles(state.player.x, state.player.y, 6);
      }
    }
  }

  state.particles.update(dt);

  if (state.won) {
    events |= EVENT_WIN;
    clearProjectiles(state.projectiles);
  } else if (state.player.hp <= 0) {
    state.over = true;
    events |= EVENT_OVER;
    state.particles.burst(state.player.x, state.player.y, '#7fe7ff', 30, 260);
  }
  return events;
}

/** Enemies still to defeat this wave (queued plus alive). */
export function enemiesLeft(state) {
  return remainingCount(state.waves, state.enemies);
}

/** The living boss, if one is on the field. */
export function liveBoss(state) {
  return state.enemies.find((enemy) => enemy.alive && (enemy.kind === 'leviathan' || enemy.kind === 'maw')) ?? null;
}

export { totalWaves, WAVES };
export const FIXED_STEP = STEP;
