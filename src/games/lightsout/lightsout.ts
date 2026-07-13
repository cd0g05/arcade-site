/**
 * lightsout.ts — Lights Out cartridge (new build).
 *
 * 5×5 toggle-neighbors puzzle on tested logic (./logic — always-solvable
 * generation). Best = fewest presses to solve (`arcade:best:lightsout`,
 * 0 = unset). Mouse-only — claims no keys. Turn-based; stop() is a no-op
 * beyond input gating (board persists in memory for resume).
 */
import "./lightsout.css";
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { CELLS, generate, isSolved, press, type LoBoard } from "./logic";

export function mountLightsOut(card: GameCard): MountedGame {
  const grid = document.createElement("div");
  grid.className = "lo";
  const status = document.createElement("div");
  status.className = "lo-status";
  card.body.insertBefore(grid, card.veil);
  card.body.insertBefore(status, card.veil);

  const cellEls: HTMLButtonElement[] = [];
  for (let i = 0; i < CELLS; i++) {
    const b = document.createElement("button");
    b.className = "lo-cell";
    b.type = "button";
    b.setAttribute("aria-label", `Light ${i + 1}`);
    b.addEventListener("click", () => onPress(i));
    grid.appendChild(b);
    cellEls.push(b);
  }

  let best = store.get<number>("best:lightsout", 0, (v): v is number => typeof v === "number");
  let board: LoBoard = [];
  let moves = 0;
  let won = false;
  let awake = false;

  const refreshStats = (): void => {
    card.setStat("MOVES", String(moves));
    card.setStat("BEST", best ? String(best) : "—");
  };

  const paint = (): void => {
    board.forEach((lit, i) => cellEls[i]?.classList.toggle("lit", lit));
  };

  function deal(): void {
    board = generate(8).board;
    moves = 0;
    won = false;
    paint();
    status.textContent = "TURN ALL THE LIGHTS OUT";
    refreshStats();
  }

  function onPress(i: number): void {
    if (!awake) return; // the waking click never counts as a press
    if (won) {
      deal();
      beep(500, 0.05);
      return;
    }
    board = press(board, i);
    moves++;
    paint();
    beep(board[i] ? 520 : 392, 0.04, "square", 0.03);
    if (isSolved(board)) {
      won = true;
      beep(880, 0.07);
      setTimeout(() => beep(1175, 0.09), 80);
      if (best === 0 || moves < best) {
        best = moves;
        store.set("best:lightsout", best);
        card.flashStat("BEST");
      }
      status.textContent = `LIGHTS OUT IN ${moves} · CLICK TO REDEAL`;
    }
    refreshStats();
  }

  deal();

  return {
    api: {
      // no keys — mouse/touch game
      start() {
        awake = true;
      },
      stop() {
        awake = false; // board + moves persist in memory for resume
      },
    },
    onReset() {
      best = 0;
      deal();
    },
  };
}
