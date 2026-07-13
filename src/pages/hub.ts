/**
 * hub.ts (page entry) — Carter's Arcade hub.
 *
 * Static structure lives in index.html; this module wires the chrome
 * (sound toggle, credits, ticker, daily number) and mounts the six hub
 * cartridges into #live-grid. Games register with the Hub singleton,
 * which owns all wake/sleep/fullscreen/key routing.
 */
import "../styles/main.css";
import { beep, soundEnabled, toggleSound } from "../lib/audio";
import { store } from "../lib/storage";
import { fillTicker } from "../ui/ticker";
import { pad, fmt } from "../games/format";

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
