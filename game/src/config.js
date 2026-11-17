// TIDEKEEPER — balance, tuning and shared constants.
// One file holds every number a designer would tune: the arena, the player, the
// enemy kinds, the ten waves, the difficulties and the upgrade pool's shape.
// Nothing here reads the clock or the network, so the game is deterministic
// for a given seed.

/** The logical playfield, in pixels. The canvas is always this size inside and scaled to fit the window. */
export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;

/** Frames of invulnerability after the player is hit (0.6 s). */
export const HIT_GRACE = 0.6;

/** Seconds the Tidal Burst needs to recharge (before upgrades). */
export const BURST_COOLDOWN = 12;

/** Tidal Burst base damage and radius. */
export const BURST = { damage: 45, radius: 190, knockback: 420 };

/** Pearls (XP) needed to reach each level: level n costs LEVEL_BASE + (n - 1) * LEVEL_STEP. */
export const LEVEL_BASE = 6;
export const LEVEL_STEP = 4;

/** How many upgrade cards a level-up offers. */
export const UPGRADE_CHOICES = 3;

/** Score: a kill is worth this times the wave it died on; clearing a wave pays WAVE_BONUS times the wave. */
export const KILL_SCORE = 10;
export const WAVE_BONUS = 100;

/** localStorage keys for the saved bests. */
export const BEST_KEY = 'tidekeeper.best.v1';
export const WINS_KEY = 'tidekeeper.wins.v1';

/** The player: a small guardian orb, drawn in code. */
export const PLAYER = {
  radius: 16,
  speed: 235,
  maxHp: 100,
  /** Coral bolts per second, before upgrades. */
  fireRate: 2.6,
  boltDamage: 12,
  boltSpeed: 540,
  boltRadius: 5,
  /** Auto-fire only aims at enemies inside this range. */
  aimRange: 560,
  /** Pearls drift to the player inside this radius (before the magnet upgrade). */
  pickupRadius: 120,
  /** Contact damage the player takes is scaled by this per enemy kind (see ENEMIES). */
  contactCooldown: HIT_GRACE,
};

/** Enemy kinds. hp and damage scale with the wave and the difficulty. */
export const ENEMIES = {
  wisp: {
    name: 'Ink Wisp', radius: 14, speed: 105, hp: 18, damage: 8, pearls: 1,
    score: 1, knockback: 1.0, color: '#7c6cf0', glow: '#b7a8ff',
  },
  darter: {
    name: 'Ink Darter', radius: 12, speed: 150, hp: 12, damage: 6, pearls: 1,
    score: 1, knockback: 1.2, color: '#4fd1c5', glow: '#9ff5ec',
    /** Lunges: accelerates toward the player when closer than this. */
    lungeRange: 220, lungeSpeed: 320,
  },
  spitter: {
    name: 'Ink Spitter', radius: 15, speed: 80, hp: 26, damage: 8, pearls: 2,
    score: 2, knockback: 0.9, color: '#f0a35e', glow: '#ffd29b',
    /** Keeps this far from the player and shoots ink blobs. */
    holdRange: 300, shotCooldown: 2.6, shotSpeed: 220, shotDamage: 6, shotRadius: 7,
  },
  splitter: {
    name: 'Ink Splitter', radius: 18, speed: 90, hp: 34, damage: 10, pearls: 2,
    score: 2, knockback: 0.8, color: '#e06ba7', glow: '#ff9ecf',
    /** Children spawned on death: [kind, count]. */
    splitsInto: ['wisp', 2],
  },
  brute: {
    name: 'Ink Brute', radius: 24, speed: 62, hp: 75, damage: 16, pearls: 4,
    score: 4, knockback: 0.35, color: '#8a5cf6', glow: '#c4a8ff',
  },
  leviathan: {
    name: 'Ink Leviathan', radius: 42, speed: 70, hp: 410, damage: 18, pearls: 15,
    score: 25, knockback: 0.1, color: '#5b8cff', glow: '#a8c4ff', boss: true,
    /** Every few seconds it summons wisps. */
    summonCooldown: 6, summonCount: 3,
  },
  maw: {
    name: 'The Maw', radius: 52, speed: 58, hp: 900, damage: 20, pearls: 0,
    score: 100, knockback: 0.05, color: '#ff5d73', glow: '#ff9aa8', boss: true,
    /** Radial ink bursts, and a faster enraged phase under half health. */
    burstCooldown: 3.2, burstCount: 9, burstSpeed: 195, burstDamage: 8,
    summonCooldown: 8, summonCount: 4, enrageAt: 0.5,
  },
};

/**
 * The ten waves. Each lists what spawns (kind: count) and how fast the spawner
 * releases them. The boss waves hold the boss back until the trickle thins.
 */
export const WAVES = [
  { spawns: { wisp: 8 }, interval: 1.1 },
  { spawns: { wisp: 10, darter: 3 }, interval: 1.0 },
  { spawns: { wisp: 8, darter: 5, spitter: 2 }, interval: 0.95 },
  { spawns: { wisp: 10, darter: 4, spitter: 4, splitter: 2 }, interval: 0.9 },
  { spawns: { wisp: 6 }, interval: 1.0, boss: 'leviathan' },
  { spawns: { wisp: 12, darter: 6, spitter: 4, splitter: 3, brute: 2 }, interval: 0.85 },
  { spawns: { wisp: 10, darter: 8, spitter: 6, splitter: 4, brute: 3 }, interval: 0.8 },
  { spawns: { wisp: 14, darter: 8, spitter: 6, splitter: 5, brute: 4 }, interval: 0.75 },
  { spawns: { wisp: 16, darter: 10, spitter: 8, splitter: 6, brute: 5 }, interval: 0.7 },
  { spawns: { wisp: 8, darter: 6 }, interval: 1.2, boss: 'maw' },
];

/** At most this many enemies alive at once; the rest wait in the wave's queue. */
export const MAX_ALIVE = 42;

/** Difficulties, picked on the title screen. Score multiplies at the end. */
export const DIFFICULTIES = [
  { id: 'calm', name: 'Calm', tag: 'Gentle seas', hp: 0.8, speed: 0.9, damage: 0.8, score: 1.0 },
  { id: 'storm', name: 'Storm', tag: 'The true tide', hp: 1.0, speed: 1.0, damage: 1.0, score: 1.25 },
  { id: 'abyss', name: 'Abyss', tag: 'No mercy', hp: 1.6, speed: 1.1, damage: 1.35, score: 1.6 },
];

/** Enemy hp grows this much per wave past the first (multiplicative). */
export const WAVE_HP_GROWTH = 0.11;
/** Enemy speed grows this much per wave past the first (multiplicative, capped). */
export const WAVE_SPEED_GROWTH = 0.02;
export const WAVE_SPEED_CAP = 1.3;

/** The upgrade pool. Each entry: id, name, flavour, max stacks, and what it does. */
export const UPGRADES = [
  { id: 'damage', name: 'Sharper Coral', text: '+25% bolt damage', max: 5 },
  { id: 'rate', name: 'Swift Current', text: '+15% fire rate', max: 5 },
  { id: 'multishot', name: 'Twin Shot', text: '+1 bolt per volley', max: 3 },
  { id: 'speed', name: 'Tailwind Fins', text: '+12% move speed', max: 5 },
  { id: 'vitality', name: 'Deep Heart', text: '+25 max HP, heal 25', max: 5 },
  { id: 'magnet', name: 'Pearl Magnet', text: '+45% pickup radius', max: 4 },
  { id: 'shells', name: 'Orbiting Shells', text: '+1 orbiting shell', max: 4 },
  { id: 'nova', name: 'Tidal Nova', text: 'Burst: -20% cooldown, +30% damage', max: 4 },
  { id: 'regen', name: 'Regen Kelp', text: 'Regenerate +0.9 HP/s', max: 4 },
  { id: 'pierce', name: 'Piercing Bolts', text: 'Bolts pierce +1 enemy', max: 3 },
  { id: 'crit', name: 'Critical Eye', text: '+12% critical chance (x2 damage)', max: 5 },
  { id: 'bulwark', name: 'Reef Bulwark', text: 'Take 12% less damage', max: 4 },
];

/** Orbiting shell stats (per shell). */
export const SHELL = { damage: 11, radius: 9, orbitRadius: 74, orbitSpeed: 2.6, hitCooldown: 0.45 };

/** Pearl (XP pickup) behaviour. */
export const PEARL = { radius: 7, magnetSpeed: 420, driftSpeed: 26, lifetime: 30 };

/** HP restored when a wave is cleared — a breather before the next tide. */
export const WAVE_CLEAR_HEAL = 12;

/** A heart heals this much; brutes and bosses drop them. */
export const HEART_HEAL = 25;
export const HEART_DROP_BRUTE = 0.35;
export const HEART_DROP_BOSS = 1.0;
