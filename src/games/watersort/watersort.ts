/**
 * watersort/watersort.ts — Water Sort cabinet cartridge. Click a tube to
 * lift it, click another to pour; only legal pours land. Levels are
 * solvable by construction (reverse-pour generation), the level counter
 * persists, and UNDO/RESTART live in the card foot.
 *
 * Mouse/touch game — claims NO keys. Tubes are inert while asleep.
 */
import "./watersort.css";
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";
import {
  generate,
  pour,
  isSolved,
  createUndo,
  WS_COLORS,
  type Tube,
} from "./logic";

const isNum = (v: unknown): v is number => typeof v === "number";

/** Colors per level: 4 at level 1, +1 every 3 levels, capped at the palette. */
const colorsFor = (level: number): number =>
  Math.min(4 + Math.floor((level - 1) / 3), WS_COLORS.length);

function mount(card: GameCard): Cartridge {
  const row = document.createElement("div");
  row.className = "ws-row";
  card.body.prepend(row);
  row.inert = true;

  let level = store.get<number>("watersort:level", 1, isNum);
  if (level < 1) level = 1;
  let tubes: Tube[] = [];
  let levelStart: Tube[] = [];
  let moves = 0;
  let selected: number | null = null;
  const undo = createUndo();
  let overTimer: ReturnType<typeof setTimeout> | null = null;

  function syncStats(): void {
    card.setStat("LEVEL", String(level));
    card.setStat("MOVES", String(moves));
    undoBtn.disabled = undo.size() === 0;
  }

  function renderTubes(newTops: Set<number> = new Set()): void {
    row.replaceChildren();
    tubes.forEach((tube, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "ws-tube" + (selected === i ? " ws-tube--sel" : "");
      el.setAttribute(
        "aria-label",
        tube.length === 0 ? `tube ${i + 1}, empty` : `tube ${i + 1}: ${tube.join(", ")}`,
      );
      tube.forEach((c, si) => {
        const seg = document.createElement("span");
        seg.className = `ws-seg ws-c-${c}`;
        if (newTops.has(i) && si === tube.length - 1) seg.classList.add("ws-seg--new");
        el.appendChild(seg);
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        pick(i);
      });
      row.appendChild(el);
    });
  }

  function deal(fresh: boolean): void {
    if (fresh) {
      tubes = generate(colorsFor(level), Math.random).tubes;
      levelStart = tubes.map((t) => [...t]);
    } else {
      tubes = levelStart.map((t) => [...t]);
    }
    moves = 0;
    selected = null;
    undo.clear();
    renderTubes();
    syncStats();
  }

  function win(): void {
    beep(988, 0.08);
    setTimeout(() => beep(1319, 0.1), 90);
    setTimeout(() => beep(1568, 0.14), 200);
    const done = level;
    level++;
    store.set("watersort:level", level);
    card.setStat("LEVEL", String(level));
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "water-sort") Hub.sleep();
      card.setVeil(`LEVEL ${done} SORTED · ${moves} MOVES`, `▶ CLICK FOR LEVEL ${level}`);
      deal(true);
    }, 1200);
  }

  function pick(i: number): void {
    if (overTimer) return; // mid-celebration
    if (selected === null) {
      if (tubes[i]?.length) {
        selected = i;
        beep(520, 0.03);
        renderTubes();
      }
      return;
    }
    if (selected === i) {
      selected = null;
      renderTubes();
      return;
    }
    const next = pour(tubes, selected, i);
    if (!next) {
      // illegal — shift the lift to the new tube if it has liquid
      beep(220, 0.05, "square");
      selected = tubes[i]?.length ? i : null;
      renderTubes();
      return;
    }
    undo.push(tubes);
    tubes = next;
    moves++;
    selected = null;
    beep(660, 0.04);
    renderTubes(new Set([i]));
    syncStats();
    if (isSolved(tubes)) win();
  }

  /* ---------- foot controls ---------- */
  const btns = document.createElement("div");
  btns.className = "ws-btns";
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "ws-btn";
  undoBtn.textContent = "UNDO";
  undoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const prev = undo.pop();
    if (!prev) return;
    tubes = prev;
    moves++;
    selected = null;
    beep(392, 0.04);
    renderTubes();
    syncStats();
  });
  const restartBtn = document.createElement("button");
  restartBtn.type = "button";
  restartBtn.className = "ws-btn";
  restartBtn.textContent = "RESTART";
  restartBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    beep(330, 0.05);
    deal(false);
  });
  btns.append(undoBtn, restartBtn);
  card.foot.prepend(btns);

  deal(true);

  return {
    // mouse/touch game — claims no keys
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
        deal(true); // celebration cut short — next level is already staged
      }
      row.inert = false;
    },
    // state-preserving pause: tubes/undo/moves survive
    stop() {
      row.inert = true;
      selected = null;
      renderTubes();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "water-sort",
    title: "WATER SORT",
    veilMsg: "▶ CLICK TO START",
    veilSub: "SORT EVERY COLOR INTO ITS OWN TUBE",
    stats: [
      { label: "LEVEL", value: "1" },
      { label: "MOVES", value: "0" },
    ],
    pill: "PUZZLE",
    legend: [
      { keys: ["CLICK", "TAP"], desc: "Lift a tube, then click another to pour." },
      { keys: ["UNDO"], desc: "Take back the last pour (counts as a move)." },
      { keys: ["RESTART"], desc: "Re-deal the same level." },
      { keys: ["ESC"], desc: "Pause. Your level is never lost." },
    ],
    legendNote:
      "ONLY LEGAL POURS LAND: MATCHING COLOR ON TOP, SPACE BELOW. EVERY LEVEL IS " +
      "SOLVABLE BY CONSTRUCTION. NO KEYS CLAIMED — THE PAGE ALWAYS SCROLLS.",
  },
  mount,
};
