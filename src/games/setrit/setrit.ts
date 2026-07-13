/**
 * setrit/setrit.ts — Setrit cabinet cartridge. 10×20 well with ghost
 * piece and next preview, soft/hard drop, level speed ramp, 7-bag, touch
 * controls (tap rotate, swipe move/drop), best persisted.
 */
import "./setrit.css";
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { gestures } from "../../lib/input";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";
import {
  COLS,
  ROWS,
  emptyBoard,
  cellsOf,
  collides,
  tryMove,
  tryRotate,
  spawn,
  lock,
  clearLines,
  scoreFor,
  levelFor,
  gravityMs,
  dropY,
  createBag,
  PIECE_COLORS,
  type Board,
  type Piece,
  type PieceType,
} from "./logic";

const CELL = 9;
const W = COLS * CELL;
const H = ROWS * CELL;
const NEXT_CELLS = 4;
const NW = NEXT_CELLS * CELL;

const isNum = (v: unknown): v is number => typeof v === "number";

function mount(card: GameCard): Cartridge {
  const wrap = document.createElement("div");
  wrap.className = "screen";
  const inner = document.createElement("div");
  inner.className = "st-wrap";

  const well = document.createElement("div");
  well.className = "st-well";
  const canvas = document.createElement("canvas");
  canvas.style.width = `${W * 1.4}px`;
  canvas.style.maxWidth = "48vw";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${W}/${H}`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Setrit well");
  well.appendChild(canvas);

  const side = document.createElement("div");
  side.className = "st-side";
  const nextLabel = document.createElement("span");
  nextLabel.textContent = "NEXT";
  const nextBox = document.createElement("div");
  nextBox.className = "st-next";
  const nextCanvas = document.createElement("canvas");
  nextCanvas.style.width = `${NW * 1.4}px`;
  nextCanvas.style.height = "auto";
  nextCanvas.style.aspectRatio = "1";
  nextCanvas.setAttribute("aria-hidden", "true");
  nextBox.appendChild(nextCanvas);
  const hint = document.createElement("span");
  hint.className = "st-hint";
  hint.textContent = "TAP ROTATE · SWIPE MOVE · SWIPE DOWN DROP";
  side.append(nextLabel, nextBox, hint);

  inner.append(well, side);
  wrap.appendChild(inner);
  card.body.prepend(wrap);

  const scr = setupScreen(canvas, W, H);
  const nscr = setupScreen(nextCanvas, NW, NW);

  let bag = createBag(Math.random);
  let board: Board = emptyBoard();
  let piece: Piece = spawn(bag());
  let nextType: PieceType = bag();
  let score = 0;
  let lines = 0;
  let best = store.get<number>("best:setrit", 0, isNum);
  let gravAcc = 0;
  let over = false;
  let overTimer: ReturnType<typeof setTimeout> | null = null;

  const level = (): number => levelFor(lines);

  function syncStats(): void {
    card.setStat("SCORE", String(score));
    card.setStat("LINES", String(lines));
    card.setStat("LVL", String(level() + 1));
    card.setStat("BEST", String(best));
  }

  function bumpBest(): void {
    if (score > best) {
      best = score;
      store.set("best:setrit", best);
      card.flashStat("BEST");
    }
  }

  function endGame(): void {
    over = true;
    beep(160, 0.35, "square");
    bumpBest();
    syncStats();
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "setrit") Hub.sleep();
      card.setVeil(`GAME OVER · SCORE ${score}`, "▶ CLICK TO PLAY AGAIN");
    }, 1000);
  }

  function reset(): void {
    bag = createBag(Math.random);
    board = emptyBoard();
    piece = spawn(bag());
    nextType = bag();
    score = 0;
    lines = 0;
    gravAcc = 0;
    over = false;
    syncStats();
  }

  function advance(): void {
    piece = spawn(nextType);
    nextType = bag();
    drawNext();
    if (collides(board, piece)) endGame();
  }

  function settle(p: Piece): void {
    board = lock(board, p);
    const res = clearLines(board);
    board = res.board;
    if (res.cleared > 0) {
      score += scoreFor(res.cleared, level());
      lines += res.cleared;
      beep(res.cleared === 4 ? 1319 : 988, 0.08);
      bumpBest();
    } else {
      beep(330, 0.03);
    }
    syncStats();
    advance();
  }

  function gravityStep(): void {
    const moved = tryMove(board, piece, 0, 1);
    if (moved) piece = moved;
    else settle(piece);
  }

  function hardDrop(): void {
    const y = dropY(board, piece);
    score += (y - piece.y) * 2;
    beep(494, 0.04);
    settle({ ...piece, y });
  }

  function softDrop(): void {
    const moved = tryMove(board, piece, 0, 1);
    if (moved) {
      piece = moved;
      score += 1;
      gravAcc = 0;
      syncStats();
    } else {
      settle(piece);
    }
  }

  function shift(dx: number): void {
    const moved = tryMove(board, piece, dx, 0);
    if (moved) {
      piece = moved;
      beep(440, 0.02);
    }
  }

  function rotate(dir: 1 | -1): void {
    const r = tryRotate(board, piece, dir);
    if (r) {
      piece = r;
      beep(587, 0.03);
    }
  }

  function update(dt: number): void {
    if (over) return;
    gravAcc += dt * 1000;
    const g = gravityMs(level());
    while (gravAcc >= g && !over) {
      gravAcc -= g;
      gravityStep();
    }
  }

  function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
  }

  function render(): void {
    const { ctx } = scr;
    scr.clear();
    ctx.fillStyle = "#e4e4e7";
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) ctx.fillRect(x * CELL + 4, y * CELL + 4, 1, 1);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const c = board[y * COLS + x];
        if (c) drawCell(ctx, x, y, c);
      }
    if (!over) {
      // ghost
      const gy = dropY(board, piece);
      ctx.globalAlpha = 0.22;
      for (const [x, y] of cellsOf({ ...piece, y: gy }))
        if (y >= 0) drawCell(ctx, x, y, PIECE_COLORS[piece.type]);
      ctx.globalAlpha = 1;
      for (const [x, y] of cellsOf(piece))
        if (y >= 0) drawCell(ctx, x, y, PIECE_COLORS[piece.type]);
    } else {
      ctx.fillStyle = "#be185d";
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.textAlign = "left";
    }
  }

  function drawNext(): void {
    const { ctx } = nscr;
    nscr.clear();
    const p: Piece = { type: nextType, rot: 0, x: 0, y: nextType === "I" ? 0 : 1 };
    for (const [x, y] of cellsOf(p)) drawCell(ctx, x, y, PIECE_COLORS[nextType]);
  }

  const loop = createLoop({ update, render });

  gestures(wrap, {
    tap() {
      if (Hub.current === "setrit" && !over) rotate(1);
    },
    swipe(dir) {
      if (Hub.current !== "setrit" || over) return;
      if (dir === "left") shift(-1);
      else if (dir === "right") shift(1);
      else if (dir === "down") hardDrop();
      else rotate(-1);
    },
  });

  syncStats();
  drawNext();
  render(); // first paint under the veil

  return {
    keys: ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "x", "X"],
    onKey(key) {
      if (over) return;
      if (key === "ArrowLeft") shift(-1);
      else if (key === "ArrowRight") shift(1);
      else if (key === "ArrowDown") softDrop();
      else if (key === "ArrowUp" || key === "x" || key === "X") rotate(1);
      else if (key === "z" || key === "Z") rotate(-1);
      else if (key === " ") hardDrop();
    },
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
      }
      if (over) reset();
      drawNext();
      loop.start();
    },
    // state-preserving pause: well/piece/score survive
    stop() {
      loop.stop();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "setrit",
    title: "SETRIT",
    veilMsg: "▶ CLICK TO START",
    veilSub: "[ARROWS] MOVE · [SPACE] DROP",
    stats: [
      { label: "SCORE", value: "0" },
      { label: "LINES", value: "0" },
      { label: "LVL", value: "1" },
      { label: "BEST", value: "0" },
    ],
    pill: "PUZZLE",
    legend: [
      { keys: ["CLICK"], desc: "Wake the well. Click anywhere else to pause." },
      { keys: ["← →"], desc: "Move the piece." },
      { keys: ["↑", "X"], desc: "Rotate clockwise (Z for counter-clockwise)." },
      { keys: ["↓"], desc: "Soft drop." },
      { keys: ["SPACE"], desc: "Hard drop." },
      { keys: ["TAP", "SWIPE"], desc: "Tap rotates; swipe moves; swipe down drops." },
      { keys: ["ESC"], desc: "Pause, or exit fullscreen." },
    ],
    legendNote:
      "LEVELS SPEED UP EVERY 10 LINES. QUAD CLEAR = 800 × LEVEL. " +
      "KEYS ONLY ROUTE HERE WHILE THE WELL IS AWAKE.",
  },
  mount,
};
