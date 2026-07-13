/**
 * minesweeper/minesweeper.ts — Minesweeper cabinet cartridge. Three classic
 * difficulties, flags via right-click or long-press, timer that only runs
 * while the game is awake AND started, best time per difficulty persisted.
 *
 * Mouse/touch game — claims NO keys; the page always scrolls normally.
 * The grid is `inert` while asleep, and the veil covers it, so the waking
 * click can never reveal a cell.
 */
import "./minesweeper.css";
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { gestures } from "../../lib/input";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";
import {
  createBoard,
  reveal,
  toggleFlag,
  DIFFICULTIES,
  type MsBoard,
  type MsPhase,
  type Difficulty,
} from "./logic";

interface Times {
  beginner?: number;
  intermediate?: number;
  expert?: number;
}

const isTimes = (v: unknown): v is Times =>
  typeof v === "object" &&
  v !== null &&
  Object.entries(v as Record<string, unknown>).every(
    ([k, n]) =>
      ["beginner", "intermediate", "expert"].includes(k) && typeof n === "number",
  );

const DIFF_LABELS: Record<string, string> = {
  beginner: "BEG",
  intermediate: "INT",
  expert: "EXP",
};

function mount(card: GameCard): Cartridge {
  const scroll = document.createElement("div");
  scroll.className = "ms-scroll";
  const grid = document.createElement("div");
  grid.className = "ms-grid";
  scroll.appendChild(grid);
  card.body.prepend(scroll);
  grid.inert = true; // asleep until the Hub wakes us

  let diff: Difficulty = DIFFICULTIES[0]!;
  let board: MsBoard = createBoard(diff.cols, diff.rows, diff.mines);
  let times = store.get<Times>("minesweeper:times", {}, isTimes);
  let elapsedMs = 0;
  let lastTick = 0;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let overTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressClickUntil = 0; // swallow the click that trails a long-press
  let cells: HTMLButtonElement[] = [];

  const secs = (): number => Math.floor(elapsedMs / 1000);

  const bestFor = (d: Difficulty): number | undefined =>
    times[d.name as keyof Times];

  function syncStats(): void {
    card.setStat("MINES", String(Math.max(0, board.mines - board.flags)));
    card.setStat("TIME", `${secs()}s`);
    const b = bestFor(diff);
    card.setStat("BEST", b === undefined ? "—" : `${b}s`);
  }

  /* ---------- timer (runs only while awake + playing) ---------- */
  function startTimer(): void {
    if (timerId !== null || board.phase !== "playing") return;
    lastTick = performance.now();
    timerId = setInterval(() => {
      elapsedMs += performance.now() - lastTick;
      lastTick = performance.now();
      card.setStat("TIME", `${secs()}s`);
    }, 250);
  }

  function stopTimer(): void {
    if (timerId === null) return;
    elapsedMs += performance.now() - lastTick;
    clearInterval(timerId);
    timerId = null;
  }

  /* ---------- rendering ---------- */
  function renderCell(i: number): void {
    const c = board.cells[i];
    const el = cells[i];
    if (!c || !el) return;
    el.className = "ms-cell";
    el.textContent = "";
    delete el.dataset["n"];
    if (c.revealed && c.mine) {
      el.classList.add("ms-cell--open", "ms-cell--mine");
      el.textContent = "✱";
    } else if (c.revealed) {
      el.classList.add("ms-cell--open");
      if (c.adj > 0) {
        el.textContent = String(c.adj);
        el.dataset["n"] = String(Math.min(c.adj, 3));
      }
    } else if (c.flagged) {
      el.classList.add("ms-cell--flag");
      el.textContent = "▲";
    }
    el.setAttribute(
      "aria-label",
      c.revealed
        ? c.mine
          ? "mine"
          : `revealed, ${c.adj} adjacent`
        : c.flagged
          ? "flagged"
          : "hidden",
    );
  }

  function renderAll(): void {
    for (let i = 0; i < cells.length; i++) renderCell(i);
    syncStats();
  }

  function buildGrid(): void {
    grid.style.gridTemplateColumns = `repeat(${board.cols}, 22px)`;
    grid.replaceChildren();
    cells = [];
    for (let i = 0; i < board.cells.length; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ms-cell";
      b.dataset["i"] = String(i);
      grid.appendChild(b);
      cells.push(b);
    }
    renderAll();
  }

  function newBoard(d: Difficulty): void {
    diff = d;
    board = createBoard(d.cols, d.rows, d.mines);
    elapsedMs = 0;
    stopTimer();
    if (overTimer) {
      clearTimeout(overTimer);
      overTimer = null;
    }
    for (const btn of diffBtns) {
      btn.classList.toggle("ms-diff--on", btn.dataset["d"] === d.name);
    }
    buildGrid();
  }

  /* ---------- end states ---------- */
  function finish(won: boolean): void {
    stopTimer();
    renderAll();
    if (won) {
      const t = secs();
      const prev = bestFor(diff);
      if (prev === undefined || t < prev) {
        times = { ...times, [diff.name]: t };
        store.set("minesweeper:times", times);
        card.flashStat("BEST");
      }
      beep(988, 0.08);
      setTimeout(() => beep(1319, 0.12), 90);
    } else {
      beep(150, 0.3, "square");
    }
    const msg = won
      ? `CLEARED IN ${secs()}s`
      : `BOOM · ${secs()}s ON THE CLOCK`;
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "minesweeper") Hub.sleep();
      card.setVeil(msg, won ? "▶ CLICK FOR A NEW BOARD" : "▶ CLICK TO TRY AGAIN");
    }, 1200);
  }

  /* ---------- input (delegated; grid is veiled+inert while asleep) ---------- */
  function cellIndex(target: EventTarget | null): number | null {
    if (!(target instanceof HTMLElement)) return null;
    const btn = target.closest<HTMLButtonElement>(".ms-cell");
    const i = btn ? Number(btn.dataset["i"]) : NaN;
    return Number.isNaN(i) ? null : i;
  }

  function doReveal(i: number): void {
    if (board.phase === "won" || board.phase === "lost") return;
    const before = board.phase;
    reveal(board, i, Math.random);
    const after = ((): MsPhase => board.phase)(); // reveal() mutates — defeat TS narrowing
    if (before === "fresh" && after !== "fresh") startTimer();
    renderAll();
    if (after === "won" || after === "lost") finish(after === "won");
    else beep(520, 0.02);
  }

  function doFlag(i: number): void {
    if (board.phase === "won" || board.phase === "lost") return;
    const cell = board.cells[i];
    if (!cell || cell.revealed) return;
    toggleFlag(board, i);
    beep(cell.flagged ? 700 : 400, 0.04);
    renderCell(i);
    syncStats();
  }

  grid.addEventListener("click", (e) => {
    if (performance.now() < suppressClickUntil) return;
    const i = cellIndex(e.target);
    if (i !== null) doReveal(i);
  });
  grid.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // element-scoped; flags on right-click
    const i = cellIndex(e.target);
    if (i !== null) doFlag(i);
  });
  gestures(grid, {
    longPress(x, y) {
      const rect = grid.getBoundingClientRect();
      const el = document.elementFromPoint(rect.left + x, rect.top + y);
      const i = cellIndex(el);
      if (i !== null) {
        suppressClickUntil = performance.now() + 500;
        doFlag(i);
      }
    },
  });

  /* ---------- difficulty picker in the card foot ---------- */
  const diffWrap = document.createElement("div");
  diffWrap.className = "ms-diffs";
  const diffBtns: HTMLButtonElement[] = [];
  for (const d of DIFFICULTIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ms-diff" + (d === diff ? " ms-diff--on" : "");
    b.dataset["d"] = d.name;
    b.textContent = DIFF_LABELS[d.name] ?? d.name.toUpperCase();
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      newBoard(d);
      card.setVeil("▶ CLICK TO START", `${d.name.toUpperCase()} · ${d.mines} MINES`);
    });
    diffWrap.appendChild(b);
    diffBtns.push(b);
  }
  card.foot.prepend(diffWrap);

  buildGrid();

  return {
    // mouse/touch game — claims no keys
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
      }
      // waking after a finished board deals a fresh one, same difficulty
      if (board.phase === "won" || board.phase === "lost") newBoard(diff);
      grid.inert = false;
      startTimer();
    },
    // state-preserving pause: board + clock freeze
    stop() {
      grid.inert = true;
      stopTimer();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "minesweeper",
    title: "MINESWEEPER",
    veilMsg: "▶ CLICK TO START",
    veilSub: "BEGINNER · 10 MINES",
    stats: [
      { label: "MINES", value: "10" },
      { label: "TIME", value: "0s" },
      { label: "BEST", value: "—" },
    ],
    pill: "PUZZLE",
    legend: [
      { keys: ["CLICK", "TAP"], desc: "Reveal a cell. First click is always safe." },
      { keys: ["RIGHT-CLICK", "LONG-PRESS"], desc: "Flag a suspected mine." },
      { keys: ["BEG / INT / EXP"], desc: "Switch difficulty (new board)." },
      { keys: ["ESC"], desc: "Pause — the clock stops with you." },
    ],
    legendNote:
      "TIMER ONLY RUNS WHILE THE BOARD IS AWAKE. BEST TIME IS KEPT PER DIFFICULTY. " +
      "NO KEYS CLAIMED — THE PAGE ALWAYS SCROLLS.",
  },
  mount,
};
