// Keyboard and mouse, read once per frame. Movement keys give a normalised
// direction; menu keys and clicks arrive as one-shot actions the game loop
// takes and clears, so a held key never fires twice.
export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_BURST = 1 << 2;
export const ACTION_RESTART = 1 << 3;
export const ACTION_MUTE = 1 << 4;
export const ACTION_UP = 1 << 5;
export const ACTION_DOWN = 1 << 6;
export const ACTION_LEFT = 1 << 7;
export const ACTION_RIGHT = 1 << 8;
export const ACTION_PICK_1 = 1 << 9;
export const ACTION_PICK_2 = 1 << 10;
export const ACTION_PICK_3 = 1 << 11;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let click = null;
  let mouse = { x: 0, y: 0, inside: false };

  function logicalPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    switch (event.code) {
      case 'Enter':
      case 'Space': actions |= ACTION_CONFIRM; break;
      case 'KeyP':
      case 'Escape': actions |= ACTION_PAUSE; break;
      case 'KeyR': actions |= ACTION_RESTART; break;
      case 'KeyM': actions |= ACTION_MUTE; break;
      case 'ArrowUp':
      case 'KeyW': actions |= ACTION_UP; break;
      case 'ArrowDown':
      case 'KeyS': actions |= ACTION_DOWN; break;
      case 'ArrowLeft':
      case 'KeyA': actions |= ACTION_LEFT; break;
      case 'ArrowRight':
      case 'KeyD': actions |= ACTION_RIGHT; break;
      case 'Digit1':
      case 'Numpad1': actions |= ACTION_PICK_1; break;
      case 'Digit2':
      case 'Numpad2': actions |= ACTION_PICK_2; break;
      case 'Digit3':
      case 'Numpad3': actions |= ACTION_PICK_3; break;
      default: break;
    }
    // Space scrolls the page and arrows move focus: the game owns those keys.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    mouse = { ...logicalPosition(event), inside: true };
  }

  function onMouseLeave() {
    mouse = { ...mouse, inside: false };
  }

  function onMouseDown(event) {
    click = logicalPosition(event);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseleave', onMouseLeave);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement direction from the held keys, {x, y}. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** One-shot actions since the last take, then cleared. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The mouse position in logical canvas pixels, and whether it is over the canvas. */
    mouse() {
      return mouse;
    },
    /** The last click's logical position since the last take, then cleared. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    /** Space doubles as the burst key while playing: true while it is held. */
    burstHeld() {
      return held.has('Space');
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('mousedown', onMouseDown);
    },
  };
}
