/**
 * miner.ts — Token Miner cartridge (idle, alwaysOn — port of the mockup).
 *
 * Never veiled, never claims keys, ticks regardless of which game is
 * awake. Math lives in ./logic (unit-tested); this module owns DOM,
 * persistence (`arcade:miner:state`), the tick/save intervals, and the
 * offline-earnings toast.
 */
import type { GameCard } from "../../ui/card";
import type { MountedGame } from "../types";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import { SPRITES } from "../../sprites/generated";
import { fmt } from "../format";
import { applyOffline, buyMiner, cost, freshState, isMinerState, type MinerState } from "./logic";

const TICK_MS = 250;
const SAVE_MS = 5000;

export function mountMiner(card: GameCard): MountedGame {
  const ck = document.createElement("div");
  ck.className = "ck";
  const countEl = document.createElement("div");
  countEl.className = "ck-count";
  const rateEl = document.createElement("div");
  rateEl.className = "ck-rate";
  const tokenBtn = document.createElement("button");
  tokenBtn.className = "ck-token";
  tokenBtn.type = "button";
  tokenBtn.setAttribute("aria-label", "Mine one token");
  tokenBtn.innerHTML = SPRITES.token; // build-time constant
  const shop = document.createElement("div");
  shop.className = "ck-shop";
  const buyBtn = document.createElement("button");
  buyBtn.className = "button button-primary";
  buyBtn.type = "button";
  const ownPill = document.createElement("span");
  ownPill.className = "pill";
  const ownEl = document.createElement("b");
  ownPill.append("MINERS ", ownEl);
  shop.append(buyBtn, ownPill);
  const toastEl = document.createElement("div");
  toastEl.className = "ck-toast";
  ck.append(countEl, rateEl, tokenBtn, shop, toastEl);
  card.body.appendChild(ck);

  const onPill = document.createElement("span");
  onPill.className = "pill pill--on";
  onPill.textContent = "ALWAYS ON";
  const fine = document.createElement("span");
  fine.className = "fine";
  fine.textContent = "MINES WHILE YOU'RE AWAY · 4H CAP";
  card.foot.append(onPill, fine);

  let s: MinerState = store.get<MinerState>("miner:state", freshState(Date.now()), isMinerState);

  // fold in time away (≤ 4 h; backwards clocks earn nothing)
  const offline = applyOffline(s, Date.now());
  s = offline.state;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  if (offline.gained >= 1) {
    toastEl.textContent = `WHILE YOU WERE GONE: +${fmt(offline.gained)}`;
    toastEl.classList.add("show");
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 4000);
  }

  function save(): void {
    s = { ...s, last: Date.now() };
    store.set("miner:state", s);
  }
  save();

  function render(): void {
    countEl.textContent = fmt(s.tokens);
    rateEl.textContent = `${s.miners}/SEC`;
    ownEl.textContent = `×${s.miners}`;
    buyBtn.textContent = `BUY MINER · ${fmt(cost(s.miners))}`;
    buyBtn.disabled = s.tokens < cost(s.miners);
  }

  tokenBtn.addEventListener("click", () => {
    s = { ...s, tokens: s.tokens + 1 };
    beep(700 + Math.random() * 80, 0.04, "square", 0.03);
    render();
  });

  buyBtn.addEventListener("click", () => {
    const res = buyMiner(s);
    if (!res.bought) return;
    s = res.state;
    beep(880, 0.07);
    setTimeout(() => beep(1175, 0.07), 70);
    save();
    render();
  });

  let tickId: ReturnType<typeof setInterval> | null = null;
  let saveId: ReturnType<typeof setInterval> | null = null;

  window.addEventListener("beforeunload", save);
  render();

  return {
    api: {
      alwaysOn: true,
      start() {
        if (tickId !== null) return;
        tickId = setInterval(() => {
          if (s.miners) {
            s = { ...s, tokens: s.tokens + s.miners * (TICK_MS / 1000) };
            render();
          }
        }, TICK_MS);
        saveId = setInterval(save, SAVE_MS);
      },
      stop() {
        // alwaysOn — the Hub never calls this; kept safe + state-preserving anyway
        if (tickId !== null) clearInterval(tickId);
        if (saveId !== null) clearInterval(saveId);
        tickId = null;
        saveId = null;
        save();
      },
    },
    onReset() {
      s = freshState(Date.now());
      if (toastTimer) clearTimeout(toastTimer);
      toastEl.classList.remove("show");
      save();
      render();
    },
  };
}
