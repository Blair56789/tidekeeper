// The menu screens drawn over the arena: title with its difficulty pick,
// pause, the level-up draft, victory and defeat. Each draw returns the
// buttons it painted, so main.js can answer mouse clicks on them.
import { DIFFICULTIES, FIELD } from './config.js';
import { finalScore, victoryStars } from './world.js';
import { maxHpOf } from './player.js';

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = 'rgba(2, 16, 30, 0.82)';
  roundRect(ctx, x, y, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(127, 231, 255, 0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 16);
  ctx.stroke();
}

function button(ctx, rect, label, selected, sub = '') {
  ctx.fillStyle = selected ? '#ffd166' : 'rgba(127, 231, 255, 0.16)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffd166' : 'rgba(127, 231, 255, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.stroke();
  ctx.fillStyle = selected ? '#06283d' : '#ffffff';
  ctx.font = '700 20px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (sub ? 2 : 7));
  if (sub) {
    ctx.fillStyle = selected ? '#06283d' : '#bfe8ff';
    ctx.font = '600 13px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h / 2 + 22);
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function statLine(ctx, x, y, label, value) {
  ctx.fillStyle = '#bfe8ff';
  ctx.font = '600 18px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 18px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(value, x + 300, y);
}

export function drawTitle(ctx, ui) {
  const buttons = [];
  const { difficultyIndex, best, wins, muted } = ui;

  ctx.fillStyle = '#7fe7ff';
  ctx.font = '700 84px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TIDEKEEPER', FIELD.width / 2, 138);
  ctx.fillStyle = '#ffd166';
  ctx.font = '600 24px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('Guardian of the Living Reef', FIELD.width / 2, 176);

  ctx.fillStyle = '#d9f4ff';
  ctx.font = '600 17px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('The Ink Tide rises in ten waves. Banish it — and the Maw — to save the reef.', FIELD.width / 2, 216);

  // Difficulty cards.
  const cardWidth = 210;
  const gap = 24;
  const total = cardWidth * 3 + gap * 2;
  const startX = (FIELD.width - total) / 2;
  DIFFICULTIES.forEach((difficulty, index) => {
    const rect = { x: startX + index * (cardWidth + gap), y: 248, w: cardWidth, h: 108 };
    const selected = index === difficultyIndex;
    const won = (wins[difficulty.id] ?? 0) > 0;
    // Opaque backing first: the arena's drifting wisps swim behind the title
    // screen and used to show through the translucent card and wash over the
    // "Score x1.25" line on the Storm card. The tint goes on top unchanged.
    ctx.fillStyle = '#02101e';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.fillStyle = selected ? 'rgba(255, 209, 102, 0.22)' : 'rgba(2, 16, 30, 0.75)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd166' : 'rgba(127, 231, 255, 0.4)';
    ctx.lineWidth = selected ? 3 : 2;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.stroke();
    ctx.fillStyle = selected ? '#ffd166' : '#ffffff';
    ctx.font = '700 24px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(difficulty.name, rect.x + rect.w / 2, rect.y + 38);
    ctx.fillStyle = '#bfe8ff';
    ctx.font = '600 14px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(difficulty.tag, rect.x + rect.w / 2, rect.y + 62);
    ctx.fillStyle = won ? '#7dffa8' : 'rgba(191,232,255,0.55)';
    ctx.font = '700 13px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(won ? '✓ Reef saved' : `Score x${difficulty.score}`, rect.x + rect.w / 2, rect.y + 88);
    buttons.push({ id: `difficulty:${difficulty.id}`, ...rect });
  });

  const startRect = { x: FIELD.width / 2 - 150, y: 392, w: 300, h: 58 };
  button(ctx, startRect, 'DIVE IN', ui.startSelected, 'Enter or click');
  buttons.push({ id: 'start', ...startRect });

  const muteRect = { x: FIELD.width / 2 - 150, y: 462, w: 300, h: 40 };
  button(ctx, muteRect, muted ? 'Sound: OFF  [M]' : 'Sound: ON  [M]', false);
  buttons.push({ id: 'mute', ...muteRect });

  ctx.fillStyle = '#bfe8ff';
  ctx.font = '600 15px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('WASD / Arrows — swim   ·   Bolts fire on their own   ·   Space — Tidal Burst   ·   P — pause', FIELD.width / 2, 548);
  if (best.score > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.font = '700 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`Best: ${best.score.toLocaleString('en-US')} pts · Wave ${best.wave} · ${best.kills} banished`, FIELD.width / 2, 580);
  }
  ctx.fillStyle = 'rgba(191,232,255,0.6)';
  ctx.font = '600 13px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('A complete game in your browser — no downloads, no network. Survive all ten waves to win.', FIELD.width / 2, 660);
  return { buttons };
}

export function drawPause(ctx, ui) {
  const buttons = [];
  panel(ctx, FIELD.width / 2 - 220, 180, 440, 340);
  ctx.fillStyle = '#7fe7ff';
  ctx.font = '700 44px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', FIELD.width / 2, 242);
  ctx.fillStyle = '#bfe8ff';
  ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('The tide waits for no one — except now.', FIELD.width / 2, 272);

  const rows = [
    { id: 'resume', label: 'Resume', sub: 'P / Esc' },
    { id: 'restart', label: 'Restart run', sub: 'R' },
    { id: 'quit', label: 'Quit to title', sub: '' },
  ];
  rows.forEach((row, index) => {
    const rect = { x: FIELD.width / 2 - 150, y: 300 + index * 66, w: 300, h: 52 };
    button(ctx, rect, row.label, ui.selected === index, row.sub);
    buttons.push({ id: row.id, ...rect });
  });
  return { buttons };
}

export function drawLevelUp(ctx, ui) {
  const buttons = [];
  panel(ctx, FIELD.width / 2 - 420, 130, 840, 400);
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 40px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`LEVEL ${ui.level}!`, FIELD.width / 2, 190);
  ctx.fillStyle = '#d9f4ff';
  ctx.font = '600 18px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('Choose an upgrade — click a card, or press 1, 2, 3.', FIELD.width / 2, 222);

  const cardWidth = 240;
  const gap = 24;
  const total = cardWidth * ui.choices.length + gap * (ui.choices.length - 1);
  const startX = (FIELD.width - total) / 2;
  ui.choices.forEach((choice, index) => {
    const rect = { x: startX + index * (cardWidth + gap), y: 250, w: cardWidth, h: 210 };
    const selected = index === ui.selected;
    ctx.fillStyle = selected ? 'rgba(255, 209, 102, 0.20)' : 'rgba(127, 231, 255, 0.10)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd166' : 'rgba(127, 231, 255, 0.45)';
    ctx.lineWidth = selected ? 3 : 2;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 21px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(choice.name, rect.x + rect.w / 2, rect.y + 52);
    ctx.fillStyle = '#7fe7ff';
    ctx.font = '600 16px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(choice.text, rect.x + rect.w / 2, rect.y + 92);
    ctx.fillStyle = '#bfe8ff';
    ctx.font = '600 14px "Trebuchet MS", Verdana, sans-serif';
    const owned = ui.stacks(choice.id);
    ctx.fillText(owned > 0 ? `Owned: ${owned} / ${choice.max}` : `New power · max ${choice.max}`, rect.x + rect.w / 2, rect.y + 132);
    ctx.fillStyle = 'rgba(191,232,255,0.6)';
    ctx.font = '700 15px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText(`[${index + 1}]`, rect.x + rect.w / 2, rect.y + 182);
    buttons.push({ id: `upgrade:${index}`, ...rect });
  });
  return { buttons };
}

export function drawVictory(ctx, state) {
  const buttons = [];
  const stars = victoryStars(state);
  panel(ctx, FIELD.width / 2 - 300, 110, 600, 500);
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 42px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE REEF IS SAVED!', FIELD.width / 2, 172);
  ctx.fillStyle = '#d9f4ff';
  ctx.font = '600 17px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('The Maw is banished. The tide is clear water again.', FIELD.width / 2, 202);

  // Stars.
  for (let i = 0; i < 3; i += 1) {
    const x = FIELD.width / 2 + (i - 1) * 64;
    const y = 248;
    ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(255,255,255,0.18)';
    ctx.font = '44px "Trebuchet MS", Verdana, sans-serif';
    ctx.fillText('★', x, y);
  }

  const left = FIELD.width / 2 - 150;
  statLine(ctx, left, 310, 'Score', finalScore(state).toLocaleString('en-US'));
  statLine(ctx, left, 340, 'Time', formatTime(state.runTime));
  statLine(ctx, left, 370, 'Banished', String(state.kills));
  statLine(ctx, left, 400, 'Level reached', String(state.player.level));
  statLine(ctx, left, 430, 'Difficulty', state.difficulty.name);
  statLine(ctx, left, 460, 'Health left', `${Math.ceil(state.player.hp)} / ${maxHpOf(state.player)}`);

  const againRect = { x: FIELD.width / 2 - 150, y: 492, w: 300, h: 52 };
  button(ctx, againRect, 'Play again', true, 'Enter / R');
  buttons.push({ id: 'again', ...againRect });
  const titleRect = { x: FIELD.width / 2 - 150, y: 552, w: 300, h: 40 };
  button(ctx, titleRect, 'Back to title', false);
  buttons.push({ id: 'title', ...titleRect });
  return { buttons };
}

export function drawDefeat(ctx, state) {
  const buttons = [];
  panel(ctx, FIELD.width / 2 - 300, 110, 600, 450);
  ctx.fillStyle = '#ff8fa3';
  ctx.font = '700 42px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE TIDE TAKES YOU…', FIELD.width / 2, 192);
  ctx.fillStyle = '#d9f4ff';
  ctx.font = '600 17px "Trebuchet MS", Verdana, sans-serif';
  ctx.fillText('The reef still waits. The Keeper rises again.', FIELD.width / 2, 222);

  const left = FIELD.width / 2 - 150;
  statLine(ctx, left, 280, 'Wave reached', `${state.waves.wave} / 10`);
  statLine(ctx, left, 310, 'Score', state.score.toLocaleString('en-US'));
  statLine(ctx, left, 340, 'Time', formatTime(state.runTime));
  statLine(ctx, left, 370, 'Banished', String(state.kills));
  statLine(ctx, left, 400, 'Level reached', String(state.player.level));

  const againRect = { x: FIELD.width / 2 - 150, y: 436, w: 300, h: 52 };
  button(ctx, againRect, 'Try again', true, 'Enter / R');
  buttons.push({ id: 'again', ...againRect });
  const titleRect = { x: FIELD.width / 2 - 150, y: 496, w: 300, h: 40 };
  button(ctx, titleRect, 'Back to title', false);
  buttons.push({ id: 'title', ...titleRect });
  return { buttons };
}
