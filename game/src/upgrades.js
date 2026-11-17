// The level-up draft: three upgrade cards rolled from the pool, never one the
// player has maxed. Applying a card changes the player's derived stats, which
// player.js recomputes from the stacks.
import { UPGRADES, UPGRADE_CHOICES } from './config.js';

export function createUpgrades() {
  const stacks = new Map();
  for (const upgrade of UPGRADES) stacks.set(upgrade.id, 0);

  return {
    stacks,
    count(id) {
      return stacks.get(id) ?? 0;
    },
    /** Roll distinct choices from the upgrades that still have room. */
    roll(random) {
      const available = UPGRADES.filter((upgrade) => stacks.get(upgrade.id) < upgrade.max);
      if (available.length === 0) return [];
      const pool = [...available];
      const choices = [];
      while (choices.length < Math.min(UPGRADE_CHOICES, pool.length)) {
        const index = Math.floor(random.next() * pool.length);
        choices.push(pool.splice(index, 1)[0]);
      }
      return choices;
    },
    apply(id) {
      stacks.set(id, (stacks.get(id) ?? 0) + 1);
    },
    /** A fallback heal when every upgrade is maxed: the draft offers pearls instead. */
    isMaxed() {
      return UPGRADES.every((upgrade) => stacks.get(upgrade.id) >= upgrade.max);
    },
  };
}

/** Derived multipliers from the upgrade stacks, read by the player and the world. */
export function derivedStats(upgrades) {
  const n = (id) => upgrades.count(id);
  return {
    damageMul: 1 + 0.25 * n('damage'),
    rateMul: 1 + 0.15 * n('rate'),
    volley: 1 + n('multishot'),
    speedMul: 1 + 0.12 * n('speed'),
    maxHpBonus: 25 * n('vitality'),
    pickupMul: 1 + 0.45 * n('magnet'),
    shells: n('shells'),
    burstCooldownMul: Math.pow(0.8, n('nova')),
    burstDamageMul: 1 + 0.3 * n('nova'),
    regen: 0.9 * n('regen'),
    pierce: n('pierce'),
    critChance: 0.12 * n('crit'),
    damageTakenMul: Math.pow(0.88, n('bulwark')),
  };
}
