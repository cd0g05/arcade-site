/**
 * echo.ts — ECHO cartridge (pattern-echo pads) (new build; no mockup counterpart).
 *
 * Pattern-echo memory game: a growing pad sequence plays back with a
 * distinct tone + flash per pad; the player echoes it by clicking/tapping.
 * Mouse-only — claims no keys, so arrows always scroll while it's awake.
 * Best streak persists (`arcade:best:echo`). stop() freezes playback
 * timers; start() re-shows the in-progress sequence from the top.
 */
import "./echo.css";
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";

const PADS = [
  { color: "#047857", tone: 330 },
  { color: "#be185d", tone: 392 },
  { color: "#9d174d", tone: 494 },
  { color: "#18181b", tone: 588 },
] as const;

const SHOW_MS = 320;
const GAP_MS = 160;
const ROUND_PAUSE_MS = 650;

type Phase = "idle" | "show" | "await" | "over";

export function mountEcho(card: GameCard): MountedGame {
  const grid = document.createElement("div");
  grid.className = "echo";
  const padEls: HTMLButtonElement[] = [];
  PADS.forEach((pad, i) => {
    const b = document.createElement("button");
    b.className = "echo-pad";
    b.type = "button";
    b.style.background = pad.color;
    b.setAttribute("aria-label", `Echo pad ${i + 1}`);
    grid.appendChild(b);
    padEls.push(b);
  });
  const status = document.createElement("div");
  status.className = "echo-status";
  card.body.insertBefore(grid, card.veil);
  card.body.insertBefore(status, card.veil);

  let best = store.get<number>("best:echo", 0, (v): v is number => typeof v === "number");
  let seq: number[] = [];
  let pos = 0; // input progress within seq
  let streak = 0; // completed rounds this game
  let phase: Phase = "idle";
  let awake = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const clearTimers = (): void => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };

  const refreshStats = (): void => {
    card.setStat("STREAK", String(streak));
    card.setStat("BEST", String(best));
  };

  function flash(i: number, ms = SHOW_MS): void {
    const el = padEls[i] as HTMLButtonElement;
    el.classList.add("lit");
    beep(PADS[i]?.tone ?? 440, ms / 1000, "square", 0.05);
    later(() => el.classList.remove("lit"), ms);
  }

  function playback(): void {
    phase = "show";
    status.textContent = "WATCH…";
    seq.forEach((padIdx, step) => {
      later(() => flash(padIdx), step * (SHOW_MS + GAP_MS));
    });
    later(() => {
      phase = "await";
      pos = 0;
      status.textContent = "YOUR TURN";
    }, seq.length * (SHOW_MS + GAP_MS));
  }

  function nextRound(): void {
    seq.push(Math.floor(Math.random() * PADS.length));
    refreshStats();
    playback();
  }

  function fail(): void {
    phase = "over";
    beep(120, 0.35, "sawtooth", 0.05);
    padEls.forEach((el) => el.classList.add("lit"));
    later(() => padEls.forEach((el) => el.classList.remove("lit")), 420);
    if (streak > best) {
      best = streak;
      store.set("best:echo", best);
      card.flashStat("BEST");
    }
    status.textContent = `WRONG! STREAK ${streak} · CLICK A PAD TO RETRY`;
    seq = [];
    refreshStats();
  }

  function onPad(i: number): void {
    if (!awake || phase === "show") return;
    if (phase === "idle" || phase === "over") {
      // (re)start a fresh game from the first pad press
      seq = [];
      streak = 0;
      refreshStats();
      later(nextRound, 150);
      phase = "show";
      return;
    }
    if (seq[pos] === i) {
      flash(i, 180);
      pos++;
      if (pos === seq.length) {
        streak = seq.length;
        refreshStats();
        status.textContent = "GOOD!";
        later(nextRound, ROUND_PAUSE_MS);
        phase = "show"; // block input during the pause
      }
    } else {
      fail();
    }
  }

  padEls.forEach((el, i) => el.addEventListener("click", () => onPad(i)));
  grid.inert = true; // asleep: pads unfocusable behind the veil
  refreshStats();
  status.textContent = "CLICK A PAD TO START";

  return {
    api: {
      // no keys — mouse/touch game; arrows keep scrolling the page
      start() {
        awake = true;
        grid.inert = false;
        if (seq.length) {
          playback(); // resume: re-show the current round
        } else {
          phase = "idle";
          status.textContent = "CLICK A PAD TO START";
        }
      },
      stop() {
        awake = false;
        grid.inert = true;
        clearTimers();
        padEls.forEach((el) => el.classList.remove("lit"));
        if (phase === "show" || phase === "await") phase = "await"; // sequence kept for resume
        status.textContent = "";
      },
    },
    onReset() {
      clearTimers();
      best = 0;
      seq = [];
      pos = 0;
      streak = 0;
      phase = "idle";
      padEls.forEach((el) => el.classList.remove("lit"));
      status.textContent = "CLICK A PAD TO START";
      refreshStats();
    },
  };
}
