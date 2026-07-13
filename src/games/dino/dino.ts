/**
 * dino.ts — Dino Run cartridge (port of the mockup game).
 *
 * Straight port of the mockup's step/draw logic onto the foundation
 * runtime: fixed-timestep loop (mockup stepped per rAF frame — its tuning
 * is 60 Hz-per-frame, so update() runs one mockup step per fixed tick),
 * pixelated 240×80 screen, tolerant storage, card stats.
 */
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { Hub } from "../../lib/hub";
import { pad } from "../format";

const W = 240;
const H = 80;
const GROUND = 64;

interface Obstacle {
  x: number;
  w: number;
  h: number;
}

export function mountDino(card: GameCard): MountedGame {
  const wrap = document.createElement("div");
  wrap.className = "screen dino-screen";
  const canvas = document.createElement("canvas");
  canvas.id = "dino-cv";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Dino Run game screen");
  wrap.appendChild(canvas);
  card.body.insertBefore(wrap, card.veil);

  const scr = setupScreen(canvas, W, H, { dprCap: 1 });
  const ctx = scr.ctx;

  let px = 24;
  let py = GROUND;
  let vy = 0;
  let obs: Obstacle[] = [];
  let clouds: { x: number; y: number }[] = [];
  let dots: { x: number; y: number }[] = [];
  let frame = 0;
  let speed = 2.0;
  let score = 0;
  let dead = false;
  let best = store.get<number>("best:dino", 0, (v): v is number => typeof v === "number");

  function reset(): void {
    py = GROUND;
    vy = 0;
    obs = [];
    frame = 0;
    speed = 2.0;
    score = 0;
    dead = false;
    clouds = [
      { x: 60, y: 12 },
      { x: 150, y: 24 },
      { x: 210, y: 8 },
    ];
    dots = [];
    for (let i = 0; i < 8; i++) dots.push({ x: Math.random() * W, y: GROUND + 5 + Math.random() * 5 });
  }

  function jump(): void {
    if (dead) {
      reset();
      beep(660, 0.05);
      return;
    }
    if (py >= GROUND) {
      vy = -6.4;
      beep(520, 0.05, "square", 0.05);
    }
  }

  function die(): void {
    dead = true;
    beep(120, 0.25, "sawtooth", 0.05);
    if (score > best) {
      best = Math.floor(score);
      store.set("best:dino", best);
      card.flashStat("BEST");
    }
  }

  function step(): void {
    frame++;
    speed = Math.min(4.2, 2.0 + frame / 900);
    vy += 0.42;
    py += vy;
    if (py > GROUND) {
      py = GROUND;
      vy = 0;
    }
    const gap = Math.max(38, 90 - Math.floor(frame / 60));
    if (frame % gap === 0 && Math.random() < 0.85) {
      obs.push({ x: W + 4, w: 6 + Math.floor(Math.random() * 6), h: 10 + Math.floor(Math.random() * 8) });
    }
    for (const o of obs) o.x -= speed;
    obs = obs.filter((o) => o.x + o.w > -4);
    for (const c of clouds) {
      c.x -= speed * 0.25;
      if (c.x < -20) c.x = W + 10;
    }
    for (const d of dots) {
      d.x -= speed;
      if (d.x < 0) d.x = W;
    }
    score = frame / 6;
    const pl = { x: px, y: py - 12, w: 10, h: 12 };
    for (const o of obs) {
      const ob = { x: o.x, y: GROUND - o.h + 1, w: o.w, h: o.h };
      if (pl.x < ob.x + ob.w && pl.x + pl.w > ob.x && pl.y < ob.y + ob.h && pl.y + pl.h > ob.y) {
        die();
        break;
      }
    }
  }

  function draw(): void {
    scr.clear();
    ctx.fillStyle = "#e4e4e7";
    for (const c of clouds) {
      ctx.fillRect(c.x | 0, c.y, 14, 3);
      ctx.fillRect((c.x | 0) + 3, c.y - 3, 8, 3);
    }
    ctx.fillStyle = "#18181b";
    ctx.fillRect(0, GROUND + 1, W, 2);
    ctx.fillStyle = "#d4d4d8";
    for (const d of dots) ctx.fillRect(d.x | 0, d.y | 0, 2, 1);
    const fy = Math.round(py);
    ctx.fillStyle = "#18181b";
    ctx.fillRect(px, fy - 12, 10, 9);
    const phase = py >= GROUND && !dead ? Math.floor(frame / 6) % 2 : 2;
    if (phase === 0) {
      ctx.fillRect(px + 1, fy - 3, 2, 3);
      ctx.fillRect(px + 7, fy - 3, 2, 3);
    } else if (phase === 1) {
      ctx.fillRect(px + 3, fy - 3, 2, 3);
      ctx.fillRect(px + 5, fy - 3, 2, 3);
    } else {
      ctx.fillRect(px + 2, fy - 3, 6, 2);
    }
    ctx.fillStyle = "#be185d";
    ctx.fillRect(px + 6, fy - 11, 2, 2);
    ctx.fillStyle = "#047857";
    for (const o of obs) {
      const oy = GROUND - o.h + 1;
      ctx.fillRect(o.x | 0, oy, o.w, o.h);
      if (o.w >= 9) {
        ctx.fillRect((o.x | 0) - 2, GROUND - Math.floor(o.h * 0.6), 2, 3);
        ctx.fillRect((o.x | 0) + o.w, GROUND - Math.floor(o.h * 0.5), 2, 3);
      }
    }
    if (dead) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#be185d";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText("GAME OVER", W / 2, 28);
      ctx.fillStyle = "#18181b";
      ctx.fillText("CLICK TO RETRY", W / 2, 44);
      ctx.textAlign = "left";
    }
  }

  function refreshStats(): void {
    card.setStat("SCORE", pad(score));
    card.setStat("BEST", pad(best));
  }

  const loop = createLoop({
    update() {
      if (!dead) step();
    },
    render() {
      draw();
      if (frame % 5 === 0 || dead) refreshStats();
    },
  });

  // jump on click/tap of the screen — only while this game is awake
  canvas.addEventListener("pointerdown", () => {
    if (Hub.current === "dino") jump();
  });

  if (document.fonts?.load) void document.fonts.load('8px "Press Start 2P"');
  reset();
  draw();
  refreshStats();

  return {
    api: {
      keys: [" ", "ArrowUp", "w", "W"],
      onKey: () => jump(),
      start: () => loop.start(),
      stop: () => loop.stop(), // state-preserving: scene stays for CLICK TO RESUME
    },
    onReset() {
      best = 0;
      reset();
      draw();
      refreshStats();
    },
  };
}
