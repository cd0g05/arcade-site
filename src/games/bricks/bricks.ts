/**
 * bricks/bricks.ts — Bricks cabinet cartridge (Breakout-alike, renamed per
 * naming doctrine). Paddle follows the pointer and arrow keys, ball speeds
 * up as bricks fall, 3 lives, layouts cycle per level, best persisted.
 *
 * All physics run in fixed-step update(); pointer input only attaches to
 * the game surface and is gated on being awake (the waking click never
 * counts — pointerdown fires before the Hub's wake mousedown).
 */
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";

const W = 240;
const H = 180;

const PADDLE_W = 40;
const PADDLE_H = 4;
const PADDLE_Y = H - 12;
const PADDLE_KEY_STEP = 18;

const BALL = 4; // ball square size
const SPEED_BASE = 130; // px/s
const SPEED_PER_LEVEL = 18;
const SPEED_PER_HIT = 1.2;
const SPEED_MAX = 280;

const COLS = 10;
const BRICK_W = 22;
const BRICK_H = 8;
const BRICK_GAP = 2;
const BRICK_TOP = 22;
const ROW_COLORS = ["#9d174d", "#be185d", "#db2777", "#ec4899", "#047857"];

/** Level layouts — 1 keeps the brick, cycled by level. */
const LAYOUTS: ((row: number, col: number) => boolean)[] = [
  () => true, // full wall
  (r, c) => (r + c) % 2 === 0, // checker
  (r, c) => c >= r && c <= COLS - 1 - r, // pyramid
  (r, c) => c % 3 !== 1 || r % 2 === 0, // columns with gaps
];

interface Brick {
  x: number;
  y: number;
  color: string;
}

const isNum = (v: unknown): v is number => typeof v === "number";

function buildBricks(level: number): Brick[] {
  const layout = LAYOUTS[level % LAYOUTS.length] ?? LAYOUTS[0]!;
  const bricks: Brick[] = [];
  const left = (W - COLS * (BRICK_W + BRICK_GAP) + BRICK_GAP) / 2;
  for (let r = 0; r < ROW_COLORS.length; r++)
    for (let c = 0; c < COLS; c++) {
      if (!layout(r, c)) continue;
      bricks.push({
        x: left + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        color: ROW_COLORS[r] ?? "#18181b",
      });
    }
  return bricks;
}

function mount(card: GameCard): Cartridge {
  const wrap = document.createElement("div");
  wrap.className = "screen";
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${W}/${H}`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Bricks playfield");
  wrap.appendChild(canvas);
  card.body.prepend(wrap);
  const scr = setupScreen(canvas, W, H);

  let best = store.get<number>("best:bricks", 0, isNum);
  let score = 0;
  let lives = 3;
  let level = 0;
  let hits = 0;
  let bricks = buildBricks(0);
  let paddleX = (W - PADDLE_W) / 2;
  let ballX = 0;
  let ballY = 0;
  let vx = 0;
  let vy = 0;
  let stuck = true; // ball riding the paddle until served
  let over = false;
  let overTimer: ReturnType<typeof setTimeout> | null = null;

  const speed = (): number =>
    Math.min(SPEED_MAX, SPEED_BASE + level * SPEED_PER_LEVEL + hits * SPEED_PER_HIT);

  function syncStats(): void {
    card.setStat("SCORE", String(score));
    card.setStat("LIVES", "■".repeat(lives) || "0");
    card.setStat("BEST", String(best));
  }

  function serve(): void {
    stuck = true;
    ballX = paddleX + PADDLE_W / 2 - BALL / 2;
    ballY = PADDLE_Y - BALL - 1;
  }

  function launch(): void {
    if (!stuck || over) return;
    stuck = false;
    const a = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 3);
    vx = Math.cos(a) * speed();
    vy = Math.sin(a) * speed();
    beep(660, 0.05);
  }

  function scoreBrick(): void {
    score += 10;
    hits++;
    beep(880 + Math.min(400, hits * 6), 0.04);
    if (score > best) {
      best = score;
      store.set("best:bricks", best);
      card.flashStat("BEST");
    }
    syncStats();
  }

  function normalizeBall(): void {
    const s = speed();
    const m = Math.hypot(vx, vy) || 1;
    vx = (vx / m) * s;
    vy = (vy / m) * s;
  }

  function endGame(): void {
    over = true;
    beep(160, 0.3, "square");
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "bricks") Hub.sleep();
      card.setVeil(`GAME OVER · SCORE ${score}`, "▶ CLICK TO PLAY AGAIN");
    }, 900);
  }

  function loseBall(): void {
    lives--;
    syncStats();
    if (lives <= 0) endGame();
    else {
      beep(220, 0.15, "square");
      serve();
    }
  }

  function update(dt: number): void {
    if (over) return;
    if (stuck) {
      ballX = paddleX + PADDLE_W / 2 - BALL / 2;
      ballY = PADDLE_Y - BALL - 1;
      return;
    }
    const px = ballX;
    const py = ballY;
    ballX += vx * dt;
    ballY += vy * dt;

    // walls
    if (ballX <= 0) {
      ballX = 0;
      vx = Math.abs(vx);
    } else if (ballX + BALL >= W) {
      ballX = W - BALL;
      vx = -Math.abs(vx);
    }
    if (ballY <= 0) {
      ballY = 0;
      vy = Math.abs(vy);
    }

    // paddle
    if (
      vy > 0 &&
      ballY + BALL >= PADDLE_Y &&
      py + BALL <= PADDLE_Y + PADDLE_H &&
      ballX + BALL >= paddleX &&
      ballX <= paddleX + PADDLE_W
    ) {
      ballY = PADDLE_Y - BALL;
      const offset = (ballX + BALL / 2 - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
      vx = offset * speed() * 0.8;
      vy = -Math.abs(vy);
      normalizeBall();
      if (Math.abs(vy) < speed() * 0.35) {
        // keep the ball from going too flat
        vy = -speed() * 0.35;
        normalizeBall();
      }
      beep(520, 0.03);
    }

    // bricks — reflect off the side with the smaller overlap
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (!b) continue;
      if (
        ballX + BALL <= b.x ||
        ballX >= b.x + BRICK_W ||
        ballY + BALL <= b.y ||
        ballY >= b.y + BRICK_H
      )
        continue;
      const fromSide = px + BALL <= b.x || px >= b.x + BRICK_W;
      if (fromSide) vx = -vx;
      else vy = -vy;
      bricks.splice(i, 1);
      scoreBrick();
      normalizeBall();
      break;
    }

    if (bricks.length === 0) {
      level++;
      bricks = buildBricks(level);
      beep(988, 0.08);
      setTimeout(() => beep(1319, 0.1), 90);
      serve();
    }

    if (ballY > H) loseBall();
  }

  function render(): void {
    const { ctx } = scr;
    scr.clear();
    for (const b of bricks) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    }
    ctx.fillStyle = "#18181b";
    ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);
    ctx.fillRect(ballX | 0, ballY | 0, BALL, BALL);
    ctx.fillStyle = "#52525b";
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(`LV ${level + 1}`, 4, 12);
    if (stuck && !over) {
      ctx.fillStyle = "#be185d";
      ctx.textAlign = "center";
      ctx.fillText("CLICK / SPACE TO SERVE", W / 2, H / 2 + 24);
      ctx.textAlign = "left";
    }
    if (over) {
      ctx.fillStyle = "#be185d";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  const loop = createLoop({ update, render });

  const clampPaddle = (x: number): number => Math.max(0, Math.min(W - PADDLE_W, x));

  // pointer steering — element-scoped, awake-gated
  wrap.addEventListener("pointermove", (e: PointerEvent) => {
    if (Hub.current !== "bricks") return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    paddleX = clampPaddle(x - PADDLE_W / 2);
  });
  wrap.addEventListener("pointerdown", () => {
    if (Hub.current === "bricks") launch();
  });

  serve();
  syncStats();
  render(); // first paint under the veil

  return {
    keys: [" ", "ArrowLeft", "ArrowRight", "a", "d", "A", "D"],
    onKey(key) {
      if (key === " ") {
        launch();
        return;
      }
      const left = key === "ArrowLeft" || key === "a" || key === "A";
      paddleX = clampPaddle(paddleX + (left ? -PADDLE_KEY_STEP : PADDLE_KEY_STEP));
    },
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
      }
      if (over) {
        score = 0;
        lives = 3;
        level = 0;
        hits = 0;
        bricks = buildBricks(0);
        over = false;
        serve();
        syncStats();
      }
      loop.start();
    },
    // state-preserving pause
    stop() {
      loop.stop();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "bricks",
    title: "BRICKS",
    veilMsg: "▶ CLICK TO START",
    veilSub: "[MOUSE] MOVE · [SPACE] SERVE",
    stats: [
      { label: "SCORE", value: "0" },
      { label: "LIVES", value: "■■■" },
      { label: "BEST", value: "0" },
    ],
    pill: "ACTION",
    legend: [
      { keys: ["CLICK"], desc: "Wake the game. Click anywhere else to pause." },
      { keys: ["MOUSE", "TOUCH"], desc: "Move the paddle." },
      { keys: ["ARROWS", "A/D"], desc: "Nudge the paddle." },
      { keys: ["SPACE", "CLICK"], desc: "Serve the ball." },
      { keys: ["ESC"], desc: "Pause, or exit fullscreen." },
      { keys: ["F"], desc: "Fullscreen (CSS takeover)." },
    ],
    legendNote:
      "CLEAR THE WALL — LAYOUTS CYCLE AND THE BALL SPEEDS UP EVERY LEVEL. 3 LIVES. " +
      "KEYS ONLY ROUTE HERE WHILE THE GAME IS AWAKE.",
  },
  mount,
};
