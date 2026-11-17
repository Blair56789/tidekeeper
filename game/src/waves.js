// The wave director: releases each wave's queue on a timer, holds the boss
// back until the wave's trickle has thinned, and calls the wave clear when
// nothing is left alive or queued. Wave 10's boss is the run's end.
import { MAX_ALIVE, WAVES } from './config.js';
import { spawnEnemy, spawnPoint } from './enemies.js';

export function createWaves() {
  return {
    wave: 0,
    queue: [],
    spawnTimer: 0,
    interval: 1,
    bossKind: null,
    bossSpawned: false,
    boss: null,
    /** Seconds of calm before the first wave and between waves. */
    restTimer: 0,
    /** The wave banner's remaining seconds, for the renderer. */
    bannerTimer: 0,
  };
}

/** How many waves the run has. */
export function totalWaves() {
  return WAVES.length;
}

/** Start a wave: fill its queue and reset its timers. */
export function startWave(director, waveNumber) {
  const wave = WAVES[waveNumber - 1];
  director.wave = waveNumber;
  director.interval = wave.interval;
  director.spawnTimer = 0.5;
  director.bossKind = wave.boss ?? null;
  director.bossSpawned = false;
  director.boss = null;
  director.queue = [];
  for (const [kind, count] of Object.entries(wave.spawns)) {
    for (let i = 0; i < count; i += 1) director.queue.push(kind);
  }
  // Shuffle the queue so the mix arrives in no fixed order.
  director.bannerTimer = 2.2;
}

/**
 * Advance the director one step. Returns 'boss' when the boss just spawned,
 * 'clear' when the wave is fully done, else null.
 */
export function stepWaves(director, dt, enemies, player, difficulty, random) {
  if (director.bannerTimer > 0) director.bannerTimer -= dt;
  if (director.restTimer > 0) {
    director.restTimer -= dt;
    return null;
  }
  const alive = enemies.filter((enemy) => enemy.alive).length;

  // The boss arrives once the queue is empty and the field has thinned.
  if (director.bossKind && !director.bossSpawned && director.queue.length === 0 && alive <= 4) {
    const point = spawnPoint(random, player);
    const boss = spawnEnemy(director.bossKind, point.x, point.y, director.wave, difficulty, random);
    enemies.push(boss);
    director.bossSpawned = true;
    director.boss = boss;
    return 'boss';
  }

  director.spawnTimer -= dt;
  if (director.queue.length > 0 && director.spawnTimer <= 0 && alive < MAX_ALIVE) {
    director.spawnTimer = director.interval * random.range(0.7, 1.3);
    const kind = director.queue.splice(Math.floor(random.next() * director.queue.length), 1)[0];
    const point = spawnPoint(random, player);
    enemies.push(spawnEnemy(kind, point.x, point.y, director.wave, difficulty, random));
  }

  if (director.queue.length === 0 && alive === 0 && (!director.bossKind || director.bossSpawned)) {
    return 'clear';
  }
  return null;
}

/** Enemies still to come this wave (queued plus alive). */
export function remainingCount(director, enemies) {
  return director.queue.length + enemies.filter((enemy) => enemy.alive).length;
}
