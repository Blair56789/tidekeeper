// Projectiles: the player's coral bolts and the enemies' ink blobs. Bolts fly
// straight and die on their pierce count; blobs fly straight and die on the
// player or the arena's edge.
import { FIELD } from './config.js';

export function createProjectiles() {
  return { bolts: [], blobs: [] };
}

export function stepProjectiles(projectiles, dt) {
  for (const list of [projectiles.bolts, projectiles.blobs]) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const shot = list[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      if (shot.life <= 0 || shot.x < -30 || shot.x > FIELD.width + 30 || shot.y < -30 || shot.y > FIELD.height + 30) {
        list.splice(i, 1);
      }
    }
  }
}

export function clearProjectiles(projectiles) {
  projectiles.bolts.length = 0;
  projectiles.blobs.length = 0;
}
