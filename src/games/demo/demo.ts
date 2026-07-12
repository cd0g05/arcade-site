/**
 * demo.ts — THROWAWAY test cartridge proving the foundation contract.
 *
 * A pixel rover you steer around a low-res screen collecting tokens.
 * Exercises every runtime piece: loop.ts (fixed timestep), screen.ts
 * (pixelated canvas), storage.ts (best score), audio.ts (beeps), input.ts
 * (tap/swipe), card stats, and the Cartridge wake/sleep contract
 * (stop() preserves state — pause and resume mid-run to verify).
 *
 * This module registers nothing itself and attaches no document listeners;
 * the page entry mounts it and registers with the Hub.
 */

import type { Cartridge } from "../../lib/cartridge";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { gestures } from "../../lib/input";
import type { GameCard } from "../../ui/card";

const W = 240;
const H = 120;
const SIZE = 8; // rover size (logical px)
const SPEED = 70; // logical px / second

type Dir = "up" | "down" | "left" | "right";

const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

export interface DemoGame {
  api: Cartridge;
  detachGestures(): void;
}

export function mountDemo(card: GameCard): DemoGame {
  // ----- surface -----
  const wrap = document.createElement("div");
  wrap.className = "screen dino-screen";
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${W}/${H}`;
  wrap.appendChild(canvas);
  card.body.prepend(wrap);
  const scr = setupScreen(canvas, W, H);

  // ----- state (preserved across sleep/wake) -----
  let x = W / 2;
  let y = H / 2;
  let dir: Dir = "right";
  let moving = true;
  let score = 0;
  let best = store.get<number>("best:demo", 0, (v): v is number => typeof v === "number");
  let tokenX = 40;
  let tokenY = 40;
  let blink = 0;

  function placeToken(): void {
    tokenX = 8 + Math.floor(Math.random() * (W - 16));
    tokenY = 8 + Math.floor(Math.random() * (H - 16));
  }

  function update(dt: number): void {
    blink += dt;
    if (!moving) return;
    const v = SPEED * dt;
    if (dir === "up") y -= v;
    if (dir === "down") y += v;
    if (dir === "left") x -= v;
    if (dir === "right") x += v;
    // wrap around the screen
    if (x < -SIZE) x = W;
    if (x > W) x = -SIZE;
    if (y < -SIZE) y = H;
    if (y > H) y = -SIZE;
    // collect
    const cx = x + SIZE / 2;
    const cy = y + SIZE / 2;
    if (Math.abs(cx - tokenX) < 8 && Math.abs(cy - tokenY) < 8) {
      score++;
      beep(700 + Math.min(500, score * 10), 0.05);
      if (score > best) {
        best = score;
        store.set("best:demo", best);
        card.setStat("BEST", String(best));
        card.flashStat("BEST");
      }
      card.setStat("SCORE", String(score));
      placeToken();
    }
  }

  function render(): void {
    const { ctx } = scr;
    scr.clear();
    // graph dots
    ctx.fillStyle = "#e4e4e7";
    for (let gy = 10; gy < H; gy += 20)
      for (let gx = 10; gx < W; gx += 20) ctx.fillRect(gx, gy, 1, 1);
    // token (blinking pink square)
    if (Math.floor(blink * 3) % 2 === 0) {
      ctx.fillStyle = "#be185d";
      ctx.fillRect((tokenX - 3) | 0, (tokenY - 3) | 0, 6, 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((tokenX - 1) | 0, (tokenY - 1) | 0, 2, 2);
    }
    // rover (ink square with green eye toward direction)
    ctx.fillStyle = "#18181b";
    ctx.fillRect(x | 0, y | 0, SIZE, SIZE);
    ctx.fillStyle = "#047857";
    const ex = dir === "left" ? 1 : dir === "right" ? SIZE - 3 : 3;
    const ey = dir === "up" ? 1 : dir === "down" ? SIZE - 3 : 3;
    ctx.fillRect((x | 0) + ex, (y | 0) + ey, 2, 2);
    if (!moving) {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText("BRAKED — SPACE", 70, 12);
    }
  }

  const loop = createLoop({ update, render });

  // touch: swipe steers, tap toggles the brake (surface is touch-action:none
  // only while awake, via .gcard.active .screen)
  const detachGestures = gestures(wrap, {
    swipe(d) {
      dir = d;
      moving = true;
    },
    tap() {
      moving = !moving;
      beep(moving ? 500 : 260, 0.05);
    },
  });

  card.setStat("SCORE", String(score));
  card.setStat("BEST", String(best));
  placeToken();
  render(); // first paint under the veil

  const api: Cartridge = {
    keys: [...Object.keys(DIR_KEYS), " "],
    onKey(key) {
      if (key === " ") {
        moving = !moving;
        beep(moving ? 500 : 260, 0.05);
        return;
      }
      const d = DIR_KEYS[key];
      if (d) {
        dir = d;
        moving = true;
      }
    },
    start() {
      loop.start();
    },
    // state-preserving: only the loop stops; position/score/token survive
    stop() {
      loop.stop();
    },
  };

  return { api, detachGestures };
}
