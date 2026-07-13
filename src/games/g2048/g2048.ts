/**
 * g2048.ts — 2048 cartridge UI (port of the mockup game).
 *
 * Rules live in ./logic (unit-tested); this module owns DOM, persistence
 * (`arcade:2048:state`, `arcade:best:2048`), sound, and the swipe/keys
 * input. Board persists across reloads; stop() is a no-op (turn-based).
 */
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { gestures } from "../../lib/input";
import { Hub } from "../../lib/hub";
import { addTile, applyMove, fresh, isOver, isSavedState, type Board } from "./logic";

const SWIPE_KEYS = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
} as const;

export function mountG2048(card: GameCard): MountedGame {
  const wrap = document.createElement("div");
  wrap.className = "b2048-wrap";
  const boardEl = document.createElement("div");
  boardEl.className = "b2048";
  const overEl = document.createElement("div");
  overEl.className = "over";
  const overMsg = document.createElement("b");
  overMsg.textContent = "NO MOVES LEFT";
  const overSub = document.createElement("span");
  overSub.className = "veil-sub";
  overSub.textContent = "CLICK FOR NEW GAME";
  overEl.append(overMsg, overSub);
  wrap.append(boardEl, overEl);
  card.body.insertBefore(wrap, card.veil);

  const cells: HTMLElement[] = [];
  for (let i = 0; i < 16; i++) {
    const d = document.createElement("div");
    d.className = "tile";
    boardEl.appendChild(d);
    cells.push(d);
  }

  const newBtn = document.createElement("button");
  newBtn.className = "button button-secondary";
  newBtn.type = "button";
  newBtn.textContent = "NEW GAME";
  newBtn.style.marginLeft = "auto";
  newBtn.style.padding = "4px 10px";
  newBtn.style.fontSize = ".62rem";
  card.foot.appendChild(newBtn);

  let best = store.get<number>("best:2048", 0, (v): v is number => typeof v === "number");
  let b: Board;
  let score: number;
  const saved = store.get<{ b: Board; s: number } | null>("2048:state", null, isSavedState);
  if (saved) {
    b = saved.b;
    score = saved.s;
  } else {
    b = fresh();
    score = 0;
  }

  const persist = (): void => store.set("2048:state", { b, s: score });

  function render(merged?: Set<number>): void {
    b.forEach((v, i) => {
      const el = cells[i] as HTMLElement;
      el.textContent = v ? String(v) : "";
      el.dataset["v"] = v > 2048 ? "max" : String(v);
      el.dataset["l"] = String(String(v).length);
      el.classList.remove("pop");
      if (merged?.has(i)) {
        void el.offsetWidth;
        el.classList.add("pop");
      }
    });
    card.setStat("SCORE", String(score));
    card.setStat("BEST", String(best));
  }

  function move(key: string): void {
    const res = applyMove(b, key);
    if (!res) return;
    if (!res.moved) {
      beep(160, 0.04, "square", 0.02);
      return;
    }
    b = res.board;
    score += res.gained;
    if (res.gained) beep(300 + Math.min(600, res.gained * 4), 0.06);
    if (score > best) {
      best = score;
      store.set("best:2048", best);
      card.flashStat("BEST");
    }
    b = addTile(b);
    persist();
    render(res.merged);
    if (isOver(b)) {
      overEl.classList.add("show");
      beep(120, 0.3, "sawtooth", 0.05);
    }
  }

  function newGame(): void {
    overEl.classList.remove("show");
    b = fresh();
    score = 0;
    persist();
    render();
    beep(500, 0.05);
  }

  newBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    newGame();
  });
  overEl.addEventListener("click", newGame);
  gestures(wrap, {
    swipe(dir) {
      if (Hub.current === "g2048") move(SWIPE_KEYS[dir]);
    },
  });

  render();
  if (isOver(b)) overEl.classList.add("show");

  return {
    api: {
      keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"],
      onKey: (k) => move(k),
      start() {}, // turn-based: renders on input only
      stop() {},
    },
    onReset() {
      best = 0;
      overEl.classList.remove("show");
      b = fresh();
      score = 0;
      render();
    },
  };
}
