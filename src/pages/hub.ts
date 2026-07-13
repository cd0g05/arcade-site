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
import { createScoreboard } from "../ui/scoreboard";
import { pad, fmt } from "../games/format";
import type { MountedGame } from "../games/types";
import { mountDino } from "../games/dino/dino";
import { mountG2048 } from "../games/g2048/g2048";
import { mountMiner } from "../games/miner/miner";
import { freshState, isMinerState } from "../games/miner/logic";
import { mountEcho } from "../games/echo/echo";
import { mountMemory } from "../games/memory/memory";
import { mountLightsOut } from "../games/lightsout/lightsout";

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

addGame(
  {
    id: "miner",
    title: "TOKEN MINER",
    centerBody: true,
    alwaysOn: true,
    ariaLabel: "Token Miner — always running",
  },
  mountMiner,
);

addGame(
  {
    id: "echo",
    title: "ECHO",
    centerBody: true,
    veilMsg: "▶ CLICK TO WAKE",
    veilSub: "ECHO THE PATTERN · CLICK OR TAP",
    stats: [
      { label: "STREAK", value: "0" },
      { label: "BEST", value: "0" },
    ],
    pill: "MEMORY",
    ariaLabel: "Echo — click to play",
  },
  mountEcho,
);

addGame(
  {
    id: "memory",
    title: "MEMORY",
    centerBody: true,
    veilMsg: "▶ CLICK TO WAKE",
    veilSub: "MATCH THE SPRITES · FEWEST MOVES WINS",
    stats: [
      { label: "MOVES", value: "0" },
      { label: "BEST", value: "—" },
    ],
    pill: "PAIRS",
    ariaLabel: "Memory — click to play",
  },
  mountMemory,
);

addGame(
  {
    id: "lightsout",
    title: "LIGHTS OUT",
    centerBody: true,
    veilMsg: "▶ CLICK TO WAKE",
    veilSub: "TURN EVERY LIGHT OFF · CLICK OR TAP",
    stats: [
      { label: "MOVES", value: "0" },
      { label: "BEST", value: "—" },
    ],
    pill: "PUZZLE",
    ariaLabel: "Lights Out — click to play",
  },
  mountLightsOut,
);

/* ---------- ticker ---------- */
const isNum = (v: unknown): v is number => typeof v === "number";
const minerTokens = (): number => store.get("miner:state", freshState(0), isMinerState).tokens;
fillTicker([
  `DINO BEST ${pad(store.get("best:dino", 0, isNum))}`,
  `2048 BEST ${store.get("best:2048", 0, isNum)}`,
  `TOKENS MINED ${fmt(minerTokens())}`,
  `ECHO STREAK ${store.get("best:echo", 0, isNum)}`,
  "13 CABINETS INSTALLED",
  "INSERT COIN FOR GOOD LUCK",
]);

/* ---------- live scoreboard ---------- */
const lowIsBest = (key: string) => (): string => {
  const v = store.get(key, 0, isNum);
  return v ? String(v) : "—";
};
const scoreboard = createScoreboard({
  "sb-dino": () => pad(store.get("best:dino", 0, isNum)),
  "sb-2048": () => String(store.get("best:2048", 0, isNum)),
  "sb-tokens": () => fmt(minerTokens()),
  "sb-echo": () => String(store.get("best:echo", 0, isNum)),
  "sb-memory": lowIsBest("best:memory"),
  "sb-lightsout": lowIsBest("best:lightsout"),
  "sb-snake": lowIsBest("best:snake"),
});
scoreboard.refresh();
setInterval(() => scoreboard.refresh(), 2000);

/* ---------- reset save data (inline confirm — no browser dialog) ---------- */
const resetSlot = $("#reset-slot");
const resetLink = $("#reset-data");

function buildLink(text: string, onClick: () => void): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = "#";
  a.textContent = text;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    onClick();
  });
  return a;
}

function armReset(): void {
  const yes = buildLink("YES", doReset);
  const no = buildLink("NO", disarmReset);
  resetSlot.replaceChildren("SURE? THIS WIPES ALL SCORES · ", yes, " / ", no);
}

function disarmReset(): void {
  resetSlot.replaceChildren(resetLink);
}

function doReset(): void {
  store.clearAll();
  for (const hook of resetHooks) hook();
  credits = 0;
  renderCr();
  scoreboard.refresh();
  beep(392, 0.08);
  const done = document.createElement("span");
  done.textContent = "SAVE DATA CLEARED";
  done.style.color = "var(--green)";
  resetSlot.replaceChildren(done);
  setTimeout(disarmReset, 3000);
}

resetLink.addEventListener("click", (e) => {
  e.preventDefault();
  armReset();
});
