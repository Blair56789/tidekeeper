// Particles and floating text: bubbles, ink bursts, pearl sparkles and damage
// numbers. Purely visual, but seeded: the particle system takes the world's
// generator so a screenshot scene renders the same frame every time.
export function createParticles(random) {
  const sparks = [];
  const texts = [];

  function addSpark({ x, y, vx, vy, life, size, color, drag = 0.92, gravity = 0 }) {
    sparks.push({ x, y, vx, vy, life, maxLife: life, size, color, drag, gravity });
  }

  return {
    /** A burst of coloured sparks, as when an enemy pops. */
    burst(x, y, color, count = 10, speed = 160) {
      for (let i = 0; i < count; i += 1) {
        const angle = random.next() * Math.PI * 2;
        const power = speed * (0.3 + random.next() * 0.9);
        addSpark({
          x, y,
          vx: Math.cos(angle) * power,
          vy: Math.sin(angle) * power - 30,
          life: 0.4 + random.next() * 0.4,
          size: 2 + random.next() * 4,
          color,
        });
      }
    },
    /** Rising bubbles, ambient and on hits. */
    bubbles(x, y, count = 4) {
      for (let i = 0; i < count; i += 1) {
        addSpark({
          x: x + random.range(-14, 14),
          y: y + random.range(-6, 6),
          vx: random.range(-12, 12),
          vy: random.range(-70, -30),
          life: 0.6 + random.next() * 0.6,
          size: 1.5 + random.next() * 3,
          color: '#bfe8ff',
          drag: 0.99,
          gravity: -30,
        });
      }
    },
    /** A ring shockwave, as when the Tidal Burst goes off. */
    ring(x, y, color, maxRadius) {
      sparks.push({ x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, size: 6, color, ring: true, maxRadius });
    },
    /** Floating combat text: damage numbers, heals, pickups. */
    floatText(x, y, text, color = '#ffffff', size = 16) {
      texts.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
    },
    update(dt) {
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.life -= dt;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        spark.vy += spark.gravity * dt;
        spark.vx *= spark.drag;
        spark.vy *= spark.drag;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const text = texts[i];
        text.life -= dt;
        text.y -= 34 * dt;
        if (text.life <= 0) texts.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const spark of sparks) {
        const alpha = Math.max(0, spark.life / spark.maxLife);
        ctx.globalAlpha = alpha;
        if (spark.ring) {
          const progress = 1 - spark.life / spark.maxLife;
          ctx.strokeStyle = spark.color;
          ctx.lineWidth = 4 * (1 - progress) + 1;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.maxRadius * progress + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const text of texts) {
        ctx.globalAlpha = Math.min(1, (text.life / text.maxLife) * 2);
        ctx.font = `700 ${text.size}px "Trebuchet MS", Verdana, sans-serif`;
        ctx.fillStyle = text.color;
        ctx.fillText(text.text, text.x, text.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      sparks.length = 0;
      texts.length = 0;
    },
  };
}
