// Pickups: pearls (XP) and hearts (healing). Pearls drift, then fly to the
// player inside the pickup radius; hearts sit still and wait to be collected.
import { FIELD, PEARL } from './config.js';

export function createPickups() {
  return [];
}

/** Drop a pearl or a heart at a position. */
export function dropPickup(pickups, kind, x, y, value, random) {
  pickups.push({
    kind,
    x: Math.min(FIELD.width - 12, Math.max(12, x + random.range(-14, 14))),
    y: Math.min(FIELD.height - 12, Math.max(12, y + random.range(-14, 14))),
    value,
    radius: kind === 'heart' ? 11 : PEARL.radius,
    life: kind === 'heart' ? 12 : PEARL.lifetime,
    wobble: random.next() * Math.PI * 2,
  });
}

/**
 * Advance the pickups. Pearls inside the magnet radius fly to the player.
 * Returns the pickups collected this step (removed from the list).
 */
export function stepPickups(pickups, dt, player, magnetRadius, magnetSpeed) {
  const collected = [];
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.life -= dt;
    pickup.wobble += dt * 4;
    if (pickup.life <= 0) {
      pickups.splice(i, 1);
      continue;
    }
    const dx = player.x - pickup.x;
    const dy = player.y - pickup.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (pickup.kind === 'pearl' && distance < magnetRadius) {
      const speed = magnetSpeed * (1.6 - distance / (magnetRadius * 1.6));
      pickup.x += (dx / distance) * speed * dt;
      pickup.y += (dy / distance) * speed * dt;
    } else {
      pickup.y += Math.sin(pickup.wobble) * PEARL.driftSpeed * dt * 0.4;
    }
    if (distance < player.radius + pickup.radius + 4) {
      collected.push(pickup);
      pickups.splice(i, 1);
    }
  }
  return collected;
}
