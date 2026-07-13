/**
 * snake/snake.ts — Snake cabinet cartridge. Grid movement on the fixed
 * loop, speed ramps with each food, arrows/WASD + swipe, best persisted.
 *
 * Game over releases the nav keys: the cartridge sleeps itself and
 * restyles the veil, so arrows scroll the page again until the next wake.
 */
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { gestures } from "../../lib/input";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";
import { fresh, step, legalTurn, type Dir, type SnakeState } from "./logic";

const COLS = 24;
const ROWS = 16;
const CELL = 10;
const W = COLS * CELL;
const H = ROWS * CELL;

/** Move interval ramp: start → floor, quicker per food. */
const MOVE_MS_START = 140;
const MOVE_MS_FLOOR = 70;
const MOVE_MS_PER_FOOD = 2.5;

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

const isNum = (v: unknown): v is number => typeof v === "number";

function mount(card: GameCard): Cartridge {
  const wrap = document.createElement("div");
  wrap.className = "screen";
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${W}/${H}`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Snake playfield");
  wrap.appendChild(canvas);
  card.body.prepend(wrap);
  const scr = setupScreen(canvas, W, H);

  let state: SnakeState = fresh(COLS, ROWS, Math.random);
  let best = store.get<number>("best:snake", 0, isNum);
  let moveAcc = 0;
  let blink = 0;
  let overTimer: ReturnType<typeof setTimeout> | null = null;
  const dirQueue: Dir[] = [];

  const moveMs = (): number =>
    Math.max(MOVE_MS_FLOOR, MOVE_MS_START - state.score * MOVE_MS_PER_FOOD);

  function queueTurn(d: Dir): void {
    const last = dirQueue[dirQueue.length - 1] ?? state.dir;
    if (legalTurn(last, d) && dirQueue.length < 3) dirQueue.push(d);
  }

  function syncStats(): void {
    card.setStat("SCORE", String(state.score));
    card.setStat("BEST", String(best));
  }

  function onEat(): void {
    beep(700 + Math.min(400, state.score * 8), 0.05);
    if (state.score > best) {
      best = state.score;
      store.set("best:snake", best);
      card.flashStat("BEST");
    }
    syncStats();
  }

  function onDie(): void {
    beep(160, 0.25, "square");
    // let the collision frame linger, then sleep — releasing nav keys —
    // and turn the veil into the game-over screen
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "snake") Hub.sleep();
      card.setVeil(`GAME OVER · SCORE ${state.score}`, "▶ CLICK TO PLAY AGAIN");
    }, 900);
  }

  function update(dt: number): void {
    blink += dt;
    if (!state.alive) return;
    moveAcc += dt * 1000;
    while (moveAcc >= moveMs() && state.alive) {
      moveAcc -= moveMs();
      const next = dirQueue.shift();
      if (next && legalTurn(state.dir, next)) state.dir = next;
      const before = state.score;
      step(state, Math.random);
      if (!state.alive) onDie();
      else if (state.score > before) onEat();
    }
  }

  function render(): void {
    const { ctx } = scr;
    scr.clear();
    // grid dots
    ctx.fillStyle = "#e4e4e7";
    for (let y = CELL; y < H; y += CELL * 2)
      for (let x = CELL; x < W; x += CELL * 2) ctx.fillRect(x, y, 1, 1);
    // food (blinking pink)
    if (Math.floor(blink * 4) % 3 !== 2) {
      ctx.fillStyle = "#be185d";
      ctx.fillRect(state.food.x * CELL + 1, state.food.y * CELL + 1, CELL - 2, CELL - 2);
    }
    // snake
    for (let i = 0; i < state.snake.length; i++) {
      const s = state.snake[i];
      if (!s) continue;
      ctx.fillStyle = i === 0 ? "#047857" : "#18181b";
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    }
    if (!state.alive) {
      ctx.fillStyle = "#be185d";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  const loop = createLoop({ update, render });

  gestures(wrap, {
    swipe(d) {
      if (Hub.current === "snake") queueTurn(d);
    },
  });

  syncStats();
  render(); // first paint under the veil

  return {
    keys: Object.keys(DIR_KEYS),
    onKey(key) {
      const d = DIR_KEYS[key];
      if (d && state.alive) queueTurn(d);
    },
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
      }
      if (!state.alive) {
        state = fresh(COLS, ROWS, Math.random);
        dirQueue.length = 0;
        moveAcc = 0;
        syncStats();
      }
      loop.start();
    },
    // state-preserving pause: mid-run position/score survive
    stop() {
      loop.stop();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "snake",
    title: "SNAKE",
    veilMsg: "▶ CLICK TO START",
    veilSub: "[ARROWS] STEER",
    stats: [
      { label: "SCORE", value: "0" },
      { label: "BEST", value: "0" },
    ],
    pill: "ACTION",
    legend: [
      { keys: ["CLICK"], desc: "Wake the snake. Click anywhere else to pause." },
      { keys: ["ARROWS", "WASD"], desc: "Steer." },
      { keys: ["SWIPE"], desc: "Steer on touch." },
      { keys: ["ESC"], desc: "Pause, or exit fullscreen." },
      { keys: ["F"], desc: "Fullscreen (CSS takeover)." },
    ],
    legendNote:
      "EAT PINK SQUARES TO GROW — EVERY BITE SPEEDS YOU UP. " +
      "KEYS ONLY ROUTE HERE WHILE THE SNAKE IS AWAKE; THE PAGE SCROLLS NORMALLY OTHERWISE.",
  },
  mount,
};
