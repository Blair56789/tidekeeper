// Enemies: the Ink Tide. Each kind has its own movement and, for the spitter
// and the bosses, its own shots. Spawned at the arena's edges, they hunt the
// player; bosses also summon and fire radial bursts.
import { ENEMIES, FIELD, WAVE_HP_GROWTH, WAVE_SPEED_CAP, WAVE_SPEED_GROWTH } from './config.js';

let nextId = 1;

export function spawnEnemy(kind, x, y, wave, difficulty, random) {
  const def = ENEMIES[kind];
  const hpMul = difficulty.hp * (1 + WAVE_HP_GROWTH * (wave - 1));
  const speedMul = difficulty.speed * Math.min(WAVE_SPEED_CAP, 1 + WAVE_SPEED_GROWTH * (wave - 1));
  return {
    id: nextId++,
    kind,
    name: def.name,
    x, y,
    vx: 0, vy: 0,
    radius: def.radius,
    speed: def.speed * speedMul,
    hp: Math.round(def.hp * hpMul),
    maxHp: Math.round(def.hp * hpMul),
    damage: Math.round(def.damage * difficulty.damage),
    pearls: def.pearls,
    score: def.score,
    knockback: def.knockback,
    color: def.color,
    glow: def.glow,
    alive: true,
    /** Seconds of knockback slide left. */
    knockTimer: 0,
    /** Wobble phase for the drifting kinds. */
    wobble: random.next() * Math.PI * 2,
    /** Shot/summon timers for the kinds that have them. */
    shotTimer: random.range(0.8, 2.0),
    summonTimer: 4,
    /** The Maw's enrage flag. */
    enraged: false,
    /** Seconds of hit flash, for the renderer. */
    flashTimer: 0,
    /** Shell hit cooldowns, per shell index. */
    shellCooldowns: new Map(),
  };
}

/** A spawn point just outside a random edge, away from the player. */
export function spawnPoint(random, player) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const edge = random.int(0, 3);
    let x;
    let y;
    if (edge === 0) { x = random.range(0, FIELD.width); y = -30; }
    else if (edge === 1) { x = FIELD.width + 30; y = random.range(0, FIELD.height); }
    else if (edge === 2) { x = random.range(0, FIELD.width); y = FIELD.height + 30; }
    else { x = -30; y = random.range(0, FIELD.height); }
    if (Math.hypot(x - player.x, y - player.y) > 320) return { x, y };
  }
  return { x: FIELD.width / 2, y: -30 };
}

/**
 * Advance one enemy. Returns any enemy shots it fired this step (ink blobs).
 * Bosses also return summons in the same list, tagged with kind 'summon'.
 */
export function stepEnemy(enemy, dt, player, random) {
  const def = ENEMIES[enemy.kind];
  const shots = [];
  if (enemy.flashTimer > 0) enemy.flashTimer -= dt;
  enemy.wobble += dt * 3;

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const nx = dx / distance;
  const ny = dy / distance;

  let speed = enemy.speed;
  let mx = nx;
  let my = ny;

  if (enemy.kind === 'wisp' || enemy.kind === 'splitter' || enemy.kind === 'brute') {
    // Drifters wobble sideways as they close in.
    const wobble = Math.sin(enemy.wobble) * 0.45;
    mx = nx - ny * wobble;
    my = ny + nx * wobble;
    const length = Math.hypot(mx, my) || 1;
    mx /= length;
    my /= length;
  } else if (enemy.kind === 'darter') {
    if (distance < def.lungeRange) speed = def.lungeSpeed;
  } else if (enemy.kind === 'spitter') {
    // Holds its distance and shoots; drifts sideways to stay out of the line of fire.
    if (distance < def.holdRange - 60) {
      mx = -nx;
      my = -ny;
    } else if (distance > def.holdRange + 60) {
      mx = nx;
      my = ny;
    } else {
      mx = -ny * Math.sin(enemy.wobble);
      my = nx * Math.sin(enemy.wobble);
    }
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && distance < 520) {
      enemy.shotTimer = def.shotCooldown * random.range(0.85, 1.2);
      shots.push({
        kind: 'shot',
        x: enemy.x,
        y: enemy.y,
        vx: nx * def.shotSpeed,
        vy: ny * def.shotSpeed,
        radius: def.shotRadius,
        damage: def.shotDamage,
        life: 4,
        color: def.glow,
      });
    }
  } else if (enemy.kind === 'leviathan') {
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = def.summonCooldown;
      for (let i = 0; i < def.summonCount; i += 1) {
        shots.push({ kind: 'summon', spawn: 'wisp', x: enemy.x + random.range(-50, 50), y: enemy.y + random.range(-50, 50) });
      }
    }
  } else if (enemy.kind === 'maw') {
    if (!enemy.enraged && enemy.hp <= enemy.maxHp * def.enrageAt) {
      enemy.enraged = true;
      speed *= 1.5;
    }
    if (enemy.enraged) speed *= 1.4;
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0) {
      enemy.shotTimer = enemy.enraged ? def.burstCooldown * 0.6 : def.burstCooldown;
      const count = enemy.enraged ? def.burstCount + 4 : def.burstCount;
      const offset = random.next() * Math.PI * 2;
      for (let i = 0; i < count; i += 1) {
        const angle = offset + (i * Math.PI * 2) / count;
        shots.push({
          kind: 'shot',
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * def.burstSpeed,
          vy: Math.sin(angle) * def.burstSpeed,
          radius: 8,
          damage: def.burstDamage,
          life: 5,
          color: def.glow,
        });
      }
    }
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = def.summonCooldown;
      for (let i = 0; i < def.summonCount; i += 1) {
        shots.push({ kind: 'summon', spawn: random.next() < 0.5 ? 'wisp' : 'darter', x: enemy.x + random.range(-60, 60), y: enemy.y + random.range(-60, 60) });
      }
    }
  }

  if (enemy.knockTimer > 0) {
    enemy.knockTimer -= dt;
  } else {
    enemy.vx = mx * speed;
    enemy.vy = my * speed;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Enemies may enter from outside, but never leave once inside.
  enemy.x = Math.min(FIELD.width + 40, Math.max(-40, enemy.x));
  enemy.y = Math.min(FIELD.height + 40, Math.max(-40, enemy.y));
  return shots;
}

/** Damage an enemy. Returns true when it died. */
export function damageEnemy(enemy, damage, kx, ky) {
  enemy.hp -= damage;
  enemy.flashTimer = 0.12;
  if (enemy.knockback > 0) {
    enemy.vx += kx * 260 * enemy.knockback;
    enemy.vy += ky * 260 * enemy.knockback;
    enemy.knockTimer = 0.12;
  }
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}
