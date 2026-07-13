/**
 * memory.ts — Memory cartridge (new build; card-flip pairs).
 *
 * A 4×4 grid of the eight pipeline sprites, two of each. A move is a pair
 * of flips; best = fewest moves to clear (persisted `arcade:best:memory`,
 * 0 = unset). Mouse-only — claims no keys. stop() resolves any pending
 * mismatch immediately and keeps the board (state-preserving).
 */
import "./memory.css";
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { SPRITES, type SpriteName } from "../../sprites/generated";

const FACES: readonly SpriteName[] = [
  "joystick",
  "token",
  "snake",
  "target",
  "tube",
  "bricks",
  "invader",
  "setrit",
];

const MISMATCH_MS = 700;

function shuffled<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function mountMemory(card: GameCard): MountedGame {
  const grid = document.createElement("div");
  grid.className = "mem";
  const status = document.createElement("div");
  status.className = "mem-status";
  card.body.insertBefore(grid, card.veil);
  card.body.insertBefore(status, card.veil);

  let best = store.get<number>("best:memory", 0, (v): v is number => typeof v === "number");
  let deck: SpriteName[] = [];
  let flipped: number[] = []; // indices of the current turn's face-up cards
  let matched = new Set<number>();
  let moves = 0;
  let won = false;
  let awake = false;
  let mismatchTimer: ReturnType<typeof setTimeout> | null = null;
  const cardEls: HTMLButtonElement[] = [];

  const refreshStats = (): void => {
    card.setStat("MOVES", String(moves));
    card.setStat("BEST", best ? String(best) : "—");
  };

  function deal(): void {
    deck = shuffled([...FACES, ...FACES]);
    flipped = [];
    matched = new Set();
    moves = 0;
    won = false;
    grid.replaceChildren();
    cardEls.length = 0;
    deck.forEach((face, i) => {
      const b = document.createElement("button");
      b.className = "mem-card";
      b.type = "button";
      b.setAttribute("aria-label", `Memory card ${i + 1}`);
      const back = document.createElement("span");
      back.className = "mem-back";
      back.textContent = "?";
      const spr = document.createElement("span");
      spr.innerHTML = SPRITES[face]; // build-time constant
      b.append(back, spr);
      b.addEventListener("click", () => onFlip(i));
      grid.appendChild(b);
      cardEls.push(b);
    });
    status.textContent = "FIND THE PAIRS";
    refreshStats();
  }

  function settleMismatch(): void {
    if (mismatchTimer !== null) {
      clearTimeout(mismatchTimer);
      mismatchTimer = null;
    }
    for (const i of flipped) cardEls[i]?.classList.remove("flipped");
    flipped = [];
  }

  function onFlip(i: number): void {
    if (!awake) return; // the waking click never counts as a flip
    if (won) {
      deal();
      beep(500, 0.05);
      return;
    }
    if (matched.has(i) || flipped.includes(i)) return;
    if (mismatchTimer !== null) settleMismatch(); // impatient third click resolves the pair early
    if (flipped.length === 2) return;

    cardEls[i]?.classList.add("flipped");
    flipped.push(i);
    beep(520 + flipped.length * 60, 0.04, "square", 0.03);

    if (flipped.length < 2) return;
    moves++;
    const [a, b] = flipped as [number, number];
    if (deck[a] === deck[b]) {
      matched.add(a).add(b);
      cardEls[a]?.classList.add("matched");
      cardEls[b]?.classList.add("matched");
      cardEls[a]?.classList.remove("flipped");
      cardEls[b]?.classList.remove("flipped");
      flipped = [];
      beep(880, 0.07);
      if (matched.size === deck.length) {
        won = true;
        setTimeout(() => beep(1175, 0.09), 80);
        if (best === 0 || moves < best) {
          best = moves;
          store.set("best:memory", best);
          card.flashStat("BEST");
        }
        status.textContent = `SOLVED IN ${moves} MOVES · CLICK TO RESHUFFLE`;
      }
    } else {
      beep(200, 0.06, "square", 0.03);
      mismatchTimer = setTimeout(settleMismatch, MISMATCH_MS);
    }
    refreshStats();
  }

  deal();
  grid.inert = true; // asleep: cards unfocusable behind the veil

  return {
    api: {
      // no keys — mouse/touch game
      start() {
        awake = true;
        grid.inert = false;
      },
      stop() {
        awake = false;
        grid.inert = true;
        settleMismatch(); // no timers may outlive sleep; board stays as-is
      },
    },
    onReset() {
      best = 0;
      settleMismatch();
      deal();
    },
  };
}
