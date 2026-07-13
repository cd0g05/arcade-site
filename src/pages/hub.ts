/**
 * hub.ts (page entry) — Carter's Arcade hub.
 *
 * Static structure lives in index.html; this module wires the chrome
 * (sound toggle, credits, ticker, daily number) and mounts the six hub
 * cartridges into #live-grid. Games register with the Hub singleton,
 * which owns all wake/sleep/fullscreen/key routing.
 */
import "../styles/main.css";
import { Hub } from "../lib/hub";
import { beep, soundEnabled, toggleSound } from "../lib/audio";
import { store } from "../lib/storage";
import { createCard, type CardOptions, type GameCard } from "../ui/card";
import { fillTicker } from "../ui/ticker";
import { pad, fmt } from "../games/format";
import type { MountedGame } from "../games/types";
import { mountDino } from "../games/dino/dino";
import { mountG2048 } from "../games/g2048/g2048";

function $<T extends HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`hub: missing ${sel}`);
  return el;
}

/* ---------- sound toggle ---------- */
const sndBtn = $<HTMLButtonElement>("#snd-btn");
const renderSnd = (): void => {
  sndBtn.textContent = `SND:${soundEnabled() ? "ON" : "OFF"}`;
};
sndBtn.addEventListener("click", () => {
  const on = toggleSound();
  renderSnd();
  if (on) beep(880, 0.06);
});
renderSnd();

/* ---------- credits / insert coin ---------- */
let credits = store.get<number>("credits", 0, (v): v is number => typeof v === "number");
const crEl = $("#credits");
const crPill = $("#cr-pill");
const renderCr = (): void => {
  crEl.textContent = String(credits).padStart(2, "0");
};
$("#coin-btn").addEventListener("click", () => {
  credits++;
  store.set("credits", credits);
  renderCr();
  beep(988, 0.05);
  setTimeout(() => beep(1319, 0.09), 60);
  crPill.classList.remove("flash");
  void crPill.offsetWidth;
  crPill.classList.add("flash");
});
renderCr();

/* ---------- daily number ---------- */
const now = new Date();
const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
document.querySelectorAll(".daily-num").forEach((el) => (el.textContent = `#${doy}`));

/* ---------- hub games ---------- */
const grid = $("#live-grid");
const resetHooks: (() => void)[] = [];

function addGame(opts: CardOptions, mount: (card: GameCard) => MountedGame): void {
  const card = createCard(opts);
  grid.appendChild(card.root);
  const mounted = mount(card);
  Hub.register(opts.id, mounted.api, card.root);
  resetHooks.push(() => mounted.onReset());
}

addGame(
  {
    id: "dino",
    title: "DINO RUN",
    wide: true,
    veilMsg: "▶ CLICK TO WAKE",
    veilSub: "[SPACE] JUMP · OR TAP",
    stats: [
      { label: "SCORE", value: "0000" },
      { label: "BEST", value: "0000" },
    ],
    pill: "RUNNER",
    ariaLabel: "Dino Run — click to play",
  },
  mountDino,
);

addGame(
  {
    id: "g2048",
    title: "2048",
    centerBody: true,
    veilMsg: "▶ CLICK TO WAKE",
    veilSub: "[ARROWS] [WASD] · OR SWIPE",
    stats: [
      { label: "SCORE", value: "0" },
      { label: "BEST", value: "0" },
    ],
    ariaLabel: "2048 — click to play",
  },
  mountG2048,
);

/* ---------- ticker ---------- */
const minerTokens = store.get<{ tokens: number }>(
  "miner:state",
  { tokens: 0 },
  (v): v is { tokens: number } =>
    typeof v === "object" && v !== null && typeof (v as { tokens?: unknown }).tokens === "number",
).tokens;
fillTicker([
  `DINO BEST ${pad(store.get<number>("best:dino", 0))}`,
  `2048 BEST ${store.get<number>("best:2048", 0)}`,
  `TOKENS MINED ${fmt(minerTokens)}`,
  `SIMON STREAK ${store.get<number>("best:simon", 0)}`,
  "13 CABINETS INSTALLED",
  "INSERT COIN FOR GOOD LUCK",
]);
