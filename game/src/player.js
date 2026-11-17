// The player: the Tidekeeper. Movement, the auto-firing coral bolts, the
// orbiting shells, the Tidal Burst and levelling. The world owns the player
// object; this file builds it and advances it one step.
import { BURST, BURST_COOLDOWN, FIELD, LEVEL_BASE, LEVEL_STEP, PEARL, PLAYER, SHELL } from './config.js';
import { derivedStats } from './upgrades.js';

export function createPlayer(upgrades) {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    level: 1,
    pearls: 0,
    pearlsNeeded: LEVEL_BASE,
    fireTimer: 0,
    burstTimer: 0,
    graceTimer: 0,
    /** Seconds since the last hit, for the hurt flash. */
    hurtTimer: 0,
    /** Angle the guardian faces (toward its aim). */
    facing: -Math.PI / 2,
    /** Orbit angle of the shells. */
    shellAngle: 0,
    /** Set for one step when a volley is fired, so the loop can play the sound. */
    fired: false,
    /** Set for one step when the burst goes off. */
    burstFired: false,
    upgrades,
  };
}

export function maxHpOf(player) {
  return PLAYER.maxHp + derivedStats(player.upgrades).maxHpBonus;
}

/** Move the player, tick the timers, and auto-fire at the nearest enemy in range. Returns fired bolts. */
export function stepPlayer(player, dt, direction, enemies, random) {
  const stats = derivedStats(player.upgrades);
  player.fired = false;
  player.burstFired = false;

  player.vx = direction.x * PLAYER.speed * stats.speedMul;
  player.vy = direction.y * PLAYER.speed * stats.speedMul;
  player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
  player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));

  if (player.graceTimer > 0) player.graceTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  if (player.burstTimer > 0) player.burstTimer -= dt;
  if (stats.regen > 0 && player.hp > 0) player.hp = Math.min(maxHpOf(player), player.hp + stats.regen * dt);
  player.shellAngle += SHELL.orbitSpeed * dt;

  // Aim at the nearest living enemy inside range.
  let target = null;
  let bestDistance = PLAYER.aimRange;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = enemy;
    }
  }
  if (target) player.facing = Math.atan2(target.y - player.y, target.x - player.x);

  const bolts = [];
  player.fireTimer -= dt;
  if (target && player.fireTimer <= 0) {
    const rate = PLAYER.fireRate * stats.rateMul;
    player.fireTimer = 1 / rate;
    player.fired = true;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    const spread = 0.14;
    for (let i = 0; i < stats.volley; i += 1) {
      const offset = (i - (stats.volley - 1) / 2) * spread;
      const angle = base + offset;
      const critical = random.next() < stats.critChance;
      bolts.push({
        x: player.x + Math.cos(angle) * (player.radius + 4),
        y: player.y + Math.sin(angle) * (player.radius + 4),
        vx: Math.cos(angle) * PLAYER.boltSpeed,
        vy: Math.sin(angle) * PLAYER.boltSpeed,
        radius: PLAYER.boltRadius,
        damage: PLAYER.boltDamage * stats.damageMul * (critical ? 2 : 1),
        pierce: stats.pierce,
        critical,
        hitIds: new Set(),
        life: 1.4,
      });
    }
  }
  return bolts;
}

/** Fire the Tidal Burst if it is ready. Returns true when it went off. */
export function fireBurst(player) {
  const stats = derivedStats(player.upgrades);
  if (player.burstTimer > 0) return false;
  player.burstTimer = BURST_COOLDOWN * stats.burstCooldownMul;
  player.burstFired = true;
  return true;
}

/** The burst's current damage and radius, after upgrades. */
export function burstStats(player) {
  const stats = derivedStats(player.upgrades);
  return { damage: BURST.damage * stats.burstDamageMul, radius: BURST.radius, knockback: BURST.knockback };
}

/** Feed the player pearls; returns how many levels were gained. */
export function addPearls(player, count) {
  player.pearls += count;
  let gained = 0;
  while (player.pearls >= player.pearlsNeeded) {
    player.pearls -= player.pearlsNeeded;
    player.level += 1;
    player.pearlsNeeded = LEVEL_BASE + (player.level - 1) * LEVEL_STEP;
    gained += 1;
  }
  return gained;
}

/** Positions of the orbiting shells this frame. */
export function shellPositions(player) {
  const stats = derivedStats(player.upgrades);
  const positions = [];
  for (let i = 0; i < stats.shells; i += 1) {
    const angle = player.shellAngle + (i * Math.PI * 2) / stats.shells;
    positions.push({
      x: player.x + Math.cos(angle) * SHELL.orbitRadius,
      y: player.y + Math.sin(angle) * SHELL.orbitRadius,
      radius: SHELL.radius,
      damage: SHELL.damage,
    });
  }
  return positions;
}

/** Hurt the player, respecting the grace window. Returns the damage actually taken. */
export function hurtPlayer(player, damage) {
  if (player.graceTimer > 0 || player.hp <= 0) return 0;
  const stats = derivedStats(player.upgrades);
  const taken = Math.max(1, Math.round(damage * stats.damageTakenMul));
  player.hp = Math.max(0, player.hp - taken);
  player.graceTimer = PLAYER.contactCooldown;
  player.hurtTimer = 0.25;
  return taken;
}

/** Heal the player, capped at max HP. Returns the HP actually restored. */
export function healPlayer(player, amount) {
  const missing = maxHpOf(player) - player.hp;
  const healed = Math.min(missing, amount);
  player.hp += healed;
  return healed;
}

/** Pickup radius after the magnet upgrade. */
export function pickupRadiusOf(player) {
  return PLAYER.pickupRadius * derivedStats(player.upgrades).pickupMul;
}

/** Pearl magnet speed: pearls inside the radius fly to the player. */
export function pearlMagnetSpeed() {
  return PEARL.magnetSpeed;
}
