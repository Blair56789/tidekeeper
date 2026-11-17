// TIDEKEEPER — boot and game loop.
//
// Owns the screen state machine (title -> play -> paused / level-up ->
// victory / defeat), the fixed-timestep loop, menu wiring, sounds, saved
// bests and the ?shot= screenshot mode the renderer captures. The world
// itself lives in world.js; this file only drives it.
import { DIFFICULTIES, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import {
  ACTION_BURST, ACTION_CONFIRM, ACTION_DOWN, ACTION_LEFT, ACTION_MUTE,
  ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART,
  ACTION_RIGHT, ACTION_UP,
} from './input.js';
import { createAudio } from './audio.js';
import { readBest, readWins, saveBest, saveWins } from './storage.js';
import {
  EVENT_BOSS_KILL, EVENT_BOSS_SPAWN, EVENT_BURST, EVENT_HEART,
  EVENT_LEVELUP, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVE_CLEAR,
  EVENT_WAVE_START, EVENT_WIN, createWorld, finalScore, liveBoss,
  stepWorld,
} from './world.js';
import {
  SCREEN_DEFEAT, SCREEN_LEVELUP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_VICTORY, createRenderer,
} from './render.js';
import {
  drawDefeat, drawLevelUp, drawPause, drawTitle, drawVictory,
} from './screens.js';
import { SHOT_TIME, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

/** The screen being shown. One of the SCREEN_* constants from render.js. */
let screen = SCREEN_TITLE;
/** The live run, null on the title screen. */
let state = null;
/** Buttons painted on the current frame, for click hit-testing. */
let buttons = [];
/** Ambient clock, seconds; fixed in shot mode so frames are deterministic. */
let clock = 0;
/** The level-up draft on offer, or null. */
let draft = null;
/** Selected row on the pause menu (0 resume, 1 restart, 2 quit). */
let pauseSelected = 0;
/** Selected difficulty card on the title screen. */
let difficultyIndex = 1;
/** Selected upgrade card in the level-up draft. */
let draftSelected = 0;

let best = readBest();
let wins = readWins();
let muted = false;

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

/** Start a fresh run on the chosen difficulty. */
function startRun(difficultyId) {
  const seed = (Math.random() * 0x7fffffff) | 0;
  state = createWorld(createRandom(seed), difficultyId);
  screen = SCREEN_PLAY;
  draft = null;
  pauseSelected = 0;
  audio.startMusic();
  announce(`Dive in! Wave 1 of 10 — ${state.difficulty.name} difficulty.`);
}

/** Back to the title screen, keeping the saved bests. */
function toTitle() {
  state = null;
  draft = null;
  screen = SCREEN_TITLE;
  audio.stopMusic();
  announce('Tidekeeper — choose a difficulty and dive in.');
}

/** Record the run's result in the saved bests. */
function recordResult() {
  if (!state) return;
  const score = finalScore(state);
  best = {
    score: Math.max(best.score, score),
    wave: Math.max(best.wave, state.waves.wave),
    kills: Math.max(best.kills, state.kills),
  };
  saveBest(best);
  if (state.won) {
    wins = { ...wins, [state.difficulty.id]: (wins[state.difficulty.id] ?? 0) + 1 };
    saveWins(wins);
  }
}

/** Open the level-up draft for the pending levels. */
function openDraft() {
  const choices = state.upgrades.roll(state.random);
  if (choices.length === 0 || state.upgrades.isMaxed()) {
    // Nothing left to offer: spend the levels and keep swimming.
    state.pendingLevels = 0;
    return;
  }
  draft = { choices, level: state.player.level };
  draftSelected = 0;
  screen = SCREEN_LEVELUP;
  audio.levelUp();
  announce(`Level ${draft.level}! Choose an upgrade — press 1, 2 or 3, or click a card.`);
}

/** Apply the chosen upgrade card; resume play when the levels are spent. */
function pickUpgrade(index) {
  if (!draft || index < 0 || index >= draft.choices.length) return;
  state.upgrades.apply(draft.choices[index].id);
  state.pendingLevels -= 1;
  audio.click();
  if (state.pendingLevels > 0) {
    openDraft();
    return;
  }
  draft = null;
  screen = SCREEN_PLAY;
  announce(`Wave ${state.waves.wave} — ${state.player.level > 1 ? `level ${state.player.level}` : 'keep swimming'}.`);
}

/** Play the sounds for one step's events, and react to the big ones. */
function handleEvents(events) {
  if (events & EVENT_SHOOT) audio.shoot();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_HEART) audio.heart();
  if (events & EVENT_BURST) audio.burst();
  if (events & EVENT_WAVE_START) {
    audio.waveStart();
    announce(`Wave ${state.waves.wave} of 10.`);
  }
  if (events & EVENT_WAVE_CLEAR) {
    announce(`Wave ${state.waves.wave} cleared!`);
  }
  if (events & EVENT_BOSS_SPAWN) {
    audio.bossRoar();
    const boss = liveBoss(state);
    announce(boss && boss.kind === 'maw'
      ? 'The Maw rises! Defeat it to save the reef!'
      : 'The Ink Leviathan stirs below!');
  }
  if (events & EVENT_BOSS_KILL) announce('Boss banished!');
  if (events & EVENT_LEVELUP) {
    if (screen === SCREEN_PLAY) openDraft();
  }
  if (events & EVENT_WIN) {
    recordResult();
    audio.win();
    audio.stopMusic();
    screen = SCREEN_VICTORY;
    announce(`The reef is saved! Score ${finalScore(state).toLocaleString('en-US')}.`);
  } else if (events & EVENT_OVER) {
    recordResult();
    audio.lose();
    audio.stopMusic();
    screen = SCREEN_DEFEAT;
    announce(`The tide takes you on wave ${state.waves.wave}. Score ${state.score.toLocaleString('en-US')}.`);
  }
}

/** One fixed step of play: input, world, events. */
function stepPlay(actions) {
  const direction = input.direction();
  const burst = input.burstHeld() || (actions & ACTION_BURST) !== 0;
  const events = stepWorld(state, STEP, direction, burst);
  handleEvents(events);
}

/** Which button, if any, contains the click point. */
function hitButton(click) {
  if (!click) return null;
  return buttons.find((b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) ?? null;
}

/** Menu keys and clicks for the current screen. */
function handleMenu(actions, click) {
  if ((actions & ACTION_MUTE) !== 0) {
    muted = !muted;
    audio.setMuted(muted);
    audio.click();
  }

  if (screen === SCREEN_TITLE) {
    if ((actions & ACTION_LEFT) !== 0) difficultyIndex = (difficultyIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length;
    if ((actions & ACTION_RIGHT) !== 0) difficultyIndex = (difficultyIndex + 1) % DIFFICULTIES.length;
    const hit = hitButton(click);
    if (hit) {
      if (hit.id.startsWith('difficulty:')) {
        difficultyIndex = DIFFICULTIES.findIndex((d) => d.id === hit.id.slice('difficulty:'.length));
        audio.click();
      } else if (hit.id === 'start') {
        audio.click();
        startRun(DIFFICULTIES[difficultyIndex].id);
      } else if (hit.id === 'mute') {
        muted = !muted;
        audio.setMuted(muted);
        audio.click();
      }
      return;
    }
    if ((actions & ACTION_CONFIRM) !== 0) {
      audio.click();
      startRun(DIFFICULTIES[difficultyIndex].id);
    }
    return;
  }

  if (screen === SCREEN_PLAY) {
    if ((actions & ACTION_PAUSE) !== 0) {
      pauseSelected = 0;
      screen = SCREEN_PAUSED;
      audio.click();
      announce('Paused.');
    }
    if ((actions & ACTION_RESTART) !== 0) {
      audio.click();
      startRun(state.difficulty.id);
    }
    return;
  }

  if (screen === SCREEN_PAUSED) {
    if ((actions & ACTION_UP) !== 0) pauseSelected = (pauseSelected + 2) % 3;
    if ((actions & ACTION_DOWN) !== 0) pauseSelected = (pauseSelected + 1) % 3;
    const hit = hitButton(click);
    if (hit) {
      if (hit.id === 'resume') {
        screen = SCREEN_PLAY;
        audio.click();
      } else if (hit.id === 'restart') {
        audio.click();
        startRun(state.difficulty.id);
      } else if (hit.id === 'quit') {
        audio.click();
        toTitle();
      }
      return;
    }
    if ((actions & ACTION_PAUSE) !== 0 || (actions & ACTION_CONFIRM) !== 0) {
      if (pauseSelected === 0) {
        screen = SCREEN_PLAY;
        audio.click();
      } else if (pauseSelected === 1) {
        audio.click();
        startRun(state.difficulty.id);
      } else {
        audio.click();
        toTitle();
      }
    }
    if ((actions & ACTION_RESTART) !== 0) {
      audio.click();
      startRun(state.difficulty.id);
    }
    return;
  }

  if (screen === SCREEN_LEVELUP) {
    if ((actions & ACTION_RESTART) !== 0) {
      audio.click();
      startRun(state.difficulty.id);
      return;
    }
    if ((actions & ACTION_LEFT) !== 0 && draft) draftSelected = (draftSelected + draft.choices.length - 1) % draft.choices.length;
    if ((actions & ACTION_RIGHT) !== 0 && draft) draftSelected = (draftSelected + 1) % draft.choices.length;
    const hit = hitButton(click);
    if (hit && hit.id.startsWith('upgrade:')) {
      pickUpgrade(Number(hit.id.slice('upgrade:'.length)));
      return;
    }
    if ((actions & ACTION_PICK_1) !== 0) pickUpgrade(0);
    else if ((actions & ACTION_PICK_2) !== 0) pickUpgrade(1);
    else if ((actions & ACTION_PICK_3) !== 0) pickUpgrade(2);
    else if ((actions & ACTION_CONFIRM) !== 0) pickUpgrade(draftSelected);
    return;
  }

  if (screen === SCREEN_VICTORY || screen === SCREEN_DEFEAT) {
    const hit = hitButton(click);
    if (hit) {
      if (hit.id === 'again') {
        audio.click();
        startRun(state.difficulty.id);
      } else if (hit.id === 'title') {
        audio.click();
        toTitle();
      }
      return;
    }
    if ((actions & ACTION_CONFIRM) !== 0 || (actions & ACTION_RESTART) !== 0) {
      audio.click();
      startRun(state.difficulty.id);
    }
  }
}

/** Paint the current screen; returns the buttons for click handling. */
let titleState = null;
function paint() {
  if (screen === SCREEN_TITLE) {
    if (!titleState) titleState = createWorld(createRandom(7), 'storm');
    renderer.draw(titleState, SCREEN_TITLE, clock);
    const result = drawTitle(ctx, { difficultyIndex, best, wins, muted, startSelected: true });
    buttons = result.buttons;
    return;
  }
  renderer.draw(state, screen, clock);
  if (screen === SCREEN_PAUSED) {
    buttons = drawPause(ctx, { selected: pauseSelected }).buttons;
  } else if (screen === SCREEN_LEVELUP && draft) {
    buttons = drawLevelUp(ctx, {
      level: draft.level,
      choices: draft.choices,
      selected: draftSelected,
      stacks: (id) => state.upgrades.count(id),
    }).buttons;
  } else if (screen === SCREEN_VICTORY) {
    buttons = drawVictory(ctx, state).buttons;
  } else if (screen === SCREEN_DEFEAT) {
    buttons = drawDefeat(ctx, state).buttons;
  } else {
    buttons = [];
  }
}

/** The main loop: fixed steps for the world, one paint per frame. */
let lastTime = performance.now();
let accumulator = 0;
function frame(now) {
  const elapsed = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  clock += elapsed;

  const actions = input.takeActions();
  const click = input.takeClick();
  handleMenu(actions, click);

  if (screen === SCREEN_PLAY && state) {
    accumulator += elapsed;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      stepPlay(actions);
      accumulator -= STEP;
      guard += 1;
      if (screen !== SCREEN_PLAY) break;
    }
    if (guard >= 8) accumulator = 0;
  }

  paint();
  requestAnimationFrame(frame);
}

// Pause when the tab hides mid-run, so a run never dies off-screen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === SCREEN_PLAY) {
    pauseSelected = 0;
    screen = SCREEN_PAUSED;
  }
});

/** Screenshot mode: stage the named scene, paint it twice, signal ready. */
function runShot() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot') ?? 'title';
  const seed = Number(params.get('seed') ?? '1');
  const staged = stageShot(name, seed);
  state = staged.state;
  screen = staged.screen;
  clock = staged.time;
  paint();
  paint();
  window.__shotReady = true;
}

if (new URLSearchParams(window.location.search).has('shot')) {
  runShot();
} else {
  announce('Tidekeeper — choose a difficulty and dive in.');
  requestAnimationFrame(frame);
}
