// The renderer: everything the player sees, drawn on one canvas in code — the
// deep-sea arena, the glowing guardian and the Ink Tide, the HUD and the wave
// banner. No images: every shape is a path, every glow a gradient.
// Screen ids are shared with main.js and screens.js.
import { FIELD } from './config.js';
import { maxHpOf, shellPositions } from './player.js';
import { enemiesLeft, liveBoss, totalWaves } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_DEFEAT = 'defeat';

/** Decorative coral silhouettes along the floor, placed once from a fixed seed. */
const CORALS = (() => {
  const list = [];
  let seed = 1234567;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 26; i += 1) {
    list.push({
      x: next() * FIELD.width,
      height: 26 + next() * 66,
      width: 10 + next() * 16,
      hue: 150 + next() * 90,
      lean: (next() - 0.5) * 0.5,
      branches: 2 + Math.floor(next() * 3),
    });
  }
  return list;
})();

/** Drifting background wisps for the title screen, placed once. */
const DRIFTERS = (() => {
  const list = [];
  let seed = 987654;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 9; i += 1) {
    list.push({
      x: next() * FIELD.width,
      y: 90 + next() * (FIELD.height - 220),
      radius: 10 + next() * 16,
      speed: 6 + next() * 14,
      phase: next() * Math.PI * 2,
      color: ['#7c6cf0', '#4fd1c5', '#f0a35e', '#e06ba7'][i % 4],
    });
  }
  return list;
})();

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function drawBackground(ctx, time, dimmed) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, '#0a3a56');
  gradient.addColorStop(0.45, '#06283d');
  gradient.addColorStop(1, '#02101d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // God rays from the surface, slowly swaying.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i += 1) {
    const sway = Math.sin(time * 0.11 + i * 1.7) * 30;
    const x = 150 + i * 240 + sway;
    const ray = ctx.createLinearGradient(x, 0, x + 90, FIELD.height * 0.75);
    ray.addColorStop(0, 'rgba(140, 220, 255, 0.10)');
    ray.addColorStop(1, 'rgba(140, 220, 255, 0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 70, 0);
    ctx.lineTo(x + 170, FIELD.height * 0.75);
    ctx.lineTo(x + 60, FIELD.height * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Sandy floor with coral silhouettes.
  ctx.fillStyle = '#0a2e23';
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height - 26);
  for (let x = 0; x <= FIELD.width; x += 80) {
    ctx.lineTo(x, FIELD.height - 26 - Math.sin(x * 0.011) * 8);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.lineTo(0, FIELD.height);
  ctx.closePath();
  ctx.fill();

  for (const coral of CORALS) {
    const baseY = FIELD.height - 22 - Math.sin(coral.x * 0.011) * 8;
    ctx.strokeStyle = `hsla(${coral.hue}, 45%, 32%, 0.9)`;
    ctx.lineWidth = coral.width * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(coral.x, baseY);
    ctx.quadraticCurveTo(
      coral.x + coral.lean * 30, baseY - coral.height * 0.6,
      coral.x + coral.lean * 46, baseY - coral.height,
    );
    ctx.stroke();
    for (let b = 0; b < coral.branches; b += 1) {
      const t = 0.35 + (b / coral.branches) * 0.55;
      const bx = coral.x + coral.lean * 46 * t;
      const by = baseY - coral.height * t;
      ctx.lineWidth = coral.width * 0.28;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (b % 2 === 0 ? 14 : -14), by - 12);
      ctx.stroke();
    }
  }

  // The Heart Coral at the arena's centre: the thing the Tidekeeper guards.
  const pulse = 1 + Math.sin(time * 1.4) * 0.06;
  const heart = ctx.createRadialGradient(640, 360, 4, 640, 360, 90 * pulse);
  heart.addColorStop(0, 'rgba(255, 209, 102, 0.20)');
  heart.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(640, 360, 90 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff9fb2';
  ctx.beginPath();
  ctx.arc(640, 360, 10 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 159, 178, 0.7)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3 + time * 0.15;
    ctx.beginPath();
    ctx.moveTo(640 + Math.cos(angle) * 12, 360 + Math.sin(angle) * 12);
    ctx.quadraticCurveTo(
      640 + Math.cos(angle) * 26, 360 + Math.sin(angle) * 26,
      640 + Math.cos(angle + 0.4) * 34, 360 + Math.sin(angle + 0.4) * 34,
    );
    ctx.stroke();
  }

  if (dimmed) {
    ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function drawDrifters(ctx, time) {
  for (const drifter of DRIFTERS) {
    const x = ((drifter.x + time * drifter.speed) % (FIELD.width + 80)) - 40;
    const y = drifter.y + Math.sin(time * 0.5 + drifter.phase) * 14;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = drifter.color;
    ctx.beginPath();
    ctx.arc(x, y, drifter.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(x, y, drifter.radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, player, time) {
  const blink = player.graceTimer > 0 && Math.floor(time * 14) % 2 === 0;
  ctx.save();
  if (blink) ctx.globalAlpha = 0.45;
  ctx.translate(player.x, player.y);

  // Glow.
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
  glow.addColorStop(0, 'rgba(127, 231, 255, 0.55)');
  glow.addColorStop(1, 'rgba(127, 231, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();

  // Body: a bright guardian orb.
  const body = ctx.createRadialGradient(-5, -6, 2, 0, 0, 18);
  body.addColorStop(0, '#e8fbff');
  body.addColorStop(0.55, '#7fe7ff');
  body.addColorStop(1, '#2aa8cc');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  // Coral crown.
  ctx.fillStyle = '#ff9fb2';
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 8 - 3, -12);
    ctx.lineTo(i * 8, -22 - (i === 0 ? 3 : 0));
    ctx.lineTo(i * 8 + 3, -12);
    ctx.closePath();
    ctx.fill();
  }

  // Eye, looking where it aims.
  ctx.rotate(player.facing);
  ctx.fillStyle = '#06283d';
  ctx.beginPath();
  ctx.arc(6, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(7, -1, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (player.hurtTimer > 0) {
    ctx.strokeStyle = 'rgba(255, 93, 115, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawShells(ctx, player, shells) {
  for (const shell of shells) {
    const glow = ctx.createRadialGradient(shell.x, shell.y, 1, shell.x, shell.y, 20);
    glow.addColorStop(0, 'rgba(255, 179, 217, 0.6)');
    glow.addColorStop(1, 'rgba(255, 179, 217, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(shell.x, shell.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7ea';
    ctx.beginPath();
    ctx.arc(shell.x, shell.y, shell.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e06ba7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(shell.x, shell.y, shell.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEnemy(ctx, enemy, time) {
  const flash = enemy.flashTimer > 0;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);

  // Glow halo.
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, enemy.radius * 2.1);
  halo.addColorStop(0, flash ? 'rgba(255,255,255,0.5)' : enemy.glow + '55');
  halo.addColorStop(1, enemy.glow + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, enemy.radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  // Body: a wobbling ink blob.
  const wobble = Math.sin(time * 6 + enemy.wobble) * 0.08;
  ctx.fillStyle = flash ? '#ffffff' : enemy.color;
  ctx.beginPath();
  const points = 10;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * Math.PI * 2;
    const radius = enemy.radius * (1 + Math.sin(angle * 3 + enemy.wobble) * wobble);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Kind marks: eyes, spikes, mouths.
  ctx.fillStyle = '#0b1020';
  if (enemy.kind === 'darter') {
    ctx.beginPath();
    ctx.moveTo(enemy.radius + 6, 0);
    ctx.lineTo(enemy.radius * 0.4, -8);
    ctx.lineTo(enemy.radius * 0.4, 8);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 2, enemy.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.glow;
    ctx.beginPath();
    ctx.arc(0, 2, enemy.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'brute') {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i * Math.PI) / 3 + enemy.wobble;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * (enemy.radius - 2), Math.sin(angle) * (enemy.radius - 2));
      ctx.lineTo(Math.cos(angle) * (enemy.radius + 9), Math.sin(angle) * (enemy.radius + 9));
      ctx.lineTo(Math.cos(angle + 0.4) * (enemy.radius - 2), Math.sin(angle + 0.4) * (enemy.radius - 2));
      ctx.closePath();
      ctx.fill();
    }
  } else if (enemy.kind === 'leviathan') {
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(-10, -6, 5, 0, Math.PI * 2);
    ctx.arc(10, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = enemy.glow;
    ctx.beginPath();
    ctx.arc(-10, -6, 2, 0, Math.PI * 2);
    ctx.arc(10, -6, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'maw') {
    // A gaping mouth ringed with teeth.
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(0, 6, enemy.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const tx = Math.cos(angle) * enemy.radius * 0.55;
      const ty = 6 + Math.sin(angle) * enemy.radius * 0.55;
      ctx.beginPath();
      ctx.moveTo(tx - 4, ty - 4);
      ctx.lineTo(tx + Math.cos(angle) * -8, ty + Math.sin(angle) * -8 + 6);
      ctx.lineTo(tx + 4, ty + 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#0b1020';
    ctx.beginPath();
    ctx.arc(-14, -16, 6, 0, Math.PI * 2);
    ctx.arc(14, -16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath();
    ctx.arc(-14, -16, 2.6, 0, Math.PI * 2);
    ctx.arc(14, -16, 2.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Wisp / splitter: two small eyes.
    ctx.beginPath();
    ctx.arc(-5, -3, 3, 0, Math.PI * 2);
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Health bar for tough enemies.
  if (enemy.maxHp >= 70 && enemy.hp < enemy.maxHp) {
    const width = enemy.radius * 2;
    ctx.fillStyle = 'rgba(2, 10, 20, 0.7)';
    ctx.fillRect(-width / 2, -enemy.radius - 14, width, 6);
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(-width / 2, -enemy.radius - 14, width * (enemy.hp / enemy.maxHp), 6);
  }
  ctx.restore();
}

function drawProjectiles(ctx, projectiles) {
  for (const bolt of projectiles.bolts) {
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bolt.x - bolt.vx * 0.03, bolt.y - bolt.vy * 0.03);
    ctx.lineTo(bolt.x, bolt.y);
    ctx.stroke();
    ctx.fillStyle = bolt.critical ? '#ffe066' : '#ffd166';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius + (bolt.critical ? 1.5 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, bolt.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const blob of projectiles.blobs) {
    const glow = ctx.createRadialGradient(blob.x, blob.y, 1, blob.x, blob.y, blob.radius * 2.4);
    glow.addColorStop(0, blob.color + '88');
    glow.addColorStop(1, blob.color + '00');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blob.color;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx, pickups, time) {
  for (const pickup of pickups) {
    const bob = Math.sin(time * 3 + pickup.wobble) * 2;
    if (pickup.kind === 'pearl') {
      const blink = pickup.life < 4 && Math.floor(time * 6) % 2 === 0;
      ctx.globalAlpha = blink ? 0.35 : 1;
      const glow = ctx.createRadialGradient(pickup.x, pickup.y + bob, 1, pickup.x, pickup.y + bob, 16);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(pickup.x - 2, pickup.y + bob - 2, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#ff6b8a';
      ctx.beginPath();
      ctx.moveTo(pickup.x, pickup.y + bob + 8);
      ctx.bezierCurveTo(pickup.x - 12, pickup.y + bob - 2, pickup.x - 6, pickup.y + bob - 10, pickup.x, pickup.y + bob - 4);
      ctx.bezierCurveTo(pickup.x + 6, pickup.y + bob - 10, pickup.x + 12, pickup.y + bob - 2, pickup.x, pickup.y + bob + 8);
      ctx.fill();
    }
  }
}

function drawHud(ctx, state) {
  const player = state.player;
  const maxHp = maxHpOf(player);

  // Top-left: HP bar and level.
  ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
  roundRect(ctx, 18, 16, 300, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#7fe7ff';
  ctx.font = '700 15px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Lv ${player.level}`, 30, 38);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, 78, 24, 220, 16, 8);
  ctx.fill();
  const hpRatio = Math.max(0, player.hp / maxHp);
  ctx.fillStyle = hpRatio > 0.35 ? '#7dffa8' : '#ff5d73';
  roundRect(ctx, 78, 24, 220 * hpRatio, 16, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(`${Math.ceil(player.hp)} / ${maxHp}`, 30, 60);

  // Top-centre: wave and enemies left.
  ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
  roundRect(ctx, FIELD.width / 2 - 130, 16, 260, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 20px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Wave ${state.waves.wave} / ${totalWaves()}`, FIELD.width / 2, 40);
  ctx.fillStyle = '#bfe8ff';
  ctx.font = '600 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(state.betweenWaves ? 'The tide ebbs…' : `${enemiesLeft(state)} ink left`, FIELD.width / 2, 60);

  // Top-right: score and kills.
  ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
  roundRect(ctx, FIELD.width - 318, 16, 300, 54, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.score.toLocaleString('en-US')} pts`, FIELD.width - 30, 40);
  ctx.fillStyle = '#bfe8ff';
  ctx.font = '600 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText(`${state.kills} banished`, FIELD.width - 30, 60);

  // Bottom: XP bar across the full width.
  const xpRatio = Math.min(1, player.pearls / player.pearlsNeeded);
  ctx.fillStyle = 'rgba(2, 10, 20, 0.6)';
  ctx.fillRect(0, FIELD.height - 14, FIELD.width, 14);
  ctx.fillStyle = '#b7a8ff';
  ctx.fillRect(0, FIELD.height - 14, FIELD.width * xpRatio, 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 11px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${player.pearls} / ${player.pearlsNeeded} pearls to Lv ${player.level + 1}`, FIELD.width / 2, FIELD.height - 3);

  // Bottom-left: Tidal Burst cooldown.
  const burstReady = player.burstTimer <= 0;
  const burstRatio = burstReady ? 1 : 1 - player.burstTimer / 12;
  ctx.fillStyle = 'rgba(2, 10, 20, 0.55)';
  roundRect(ctx, 18, FIELD.height - 74, 190, 44, 10);
  ctx.fill();
  ctx.fillStyle = burstReady ? '#7fe7ff' : 'rgba(127,231,255,0.35)';
  ctx.beginPath();
  ctx.arc(40, FIELD.height - 52, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#06283d';
  ctx.font = '700 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('~', 40, FIELD.height - 47);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(burstReady ? 'Tidal Burst [Space]' : `Burst in ${player.burstTimer.toFixed(1)}s`, 60, FIELD.height - 47);
  if (!burstReady) {
    ctx.fillStyle = 'rgba(127,231,255,0.35)';
    ctx.fillRect(60, FIELD.height - 40, 130 * burstRatio, 4);
  }

  // Boss bar under the wave plate.
  const boss = liveBoss(state);
  if (boss) {
    ctx.fillStyle = 'rgba(2, 10, 20, 0.6)';
    roundRect(ctx, FIELD.width / 2 - 260, 78, 520, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ff5d73';
    ctx.font = '700 14px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(boss.name + (boss.enraged ? ' — ENRAGED' : ''), FIELD.width / 2, 97);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(FIELD.width / 2 - 240, 100, 480, 6);
    ctx.fillStyle = boss.enraged ? '#ff2e4d' : '#ff5d73';
    ctx.fillRect(FIELD.width / 2 - 240, 100, 480 * Math.max(0, boss.hp / boss.maxHp), 6);
  }

  // Wave banner.
  if (state.waves.bannerTimer > 0) {
    const alpha = Math.min(1, state.waves.bannerTimer);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 44px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.waves.wave === 10 ? 'THE MAW RISES' : `Wave ${state.waves.wave}`, FIELD.width / 2, 150);
    ctx.fillStyle = '#bfe8ff';
    ctx.font = '600 18px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(
      state.waves.wave === 10 ? 'Defeat it to save the reef' : state.waves.wave === 5 ? 'Something huge stirs below…' : 'The Ink Tide rises',
      FIELD.width / 2, 180,
    );
    ctx.globalAlpha = 1;
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    /** Paint the world and the HUD for a screen. `time` is seconds, for ambient motion. */
    draw(state, screen, time) {
      ctx.save();
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      if (state.shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      const dimmed = screen === SCREEN_PAUSED || screen === SCREEN_LEVELUP;
      drawBackground(ctx, time, dimmed);
      if (screen === SCREEN_TITLE) drawDrifters(ctx, time);
      if (screen !== SCREEN_TITLE) {
        drawPickups(ctx, state.pickups, time);
        for (const enemy of state.enemies) {
          if (enemy.alive) drawEnemy(ctx, enemy, time);
        }
        drawProjectiles(ctx, state.projectiles);
        if (!state.over) {
          drawShells(ctx, state.player, shellPositions(state.player));
        }
        if (!state.over) drawPlayer(ctx, state.player, time);
        state.particles.draw(ctx);
        if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEVELUP) {
          drawHud(ctx, state);
        }
      } else {
        state.particles.draw(ctx);
      }
      ctx.restore();
    },
  };
}
