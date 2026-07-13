/**
 * aim/aim.ts — Aim Trainer cabinet cartridge. 30-second timed round:
 * targets bloom and shrink, click/tap them before they vanish. Tracks
 * hits + accuracy, persists best hits. Pure pointer game — claims NO
 * keys, so arrows/space always scroll the cabinet page.
 *
 * The waking click never counts as a shot: the surface pointerdown is
 * gated on Hub.current, which is still null when it fires (the Hub wakes
 * on the later mousedown).
 */
import type { Cartridge } from "../../lib/cartridge";
import { Hub } from "../../lib/hub";
import { createLoop } from "../../lib/loop";
import { setupScreen } from "../../lib/screen";
import { store } from "../../lib/storage";
import { beep } from "../../lib/audio";
import type { GameCard } from "../../ui/card";
import type { CabinetDef } from "../types";

const W = 240;
const H = 180;

const ROUND_S = 30;
const TARGET_LIFE_S = 1.8;
const TARGET_MAX_R = 13;
const MAX_TARGETS = 3;
const SPAWN_EVERY_S = 0.55;
const MARGIN = 18;

interface Target {
  x: number;
  y: number;
  /** Age in seconds; radius blooms to max at half-life then shrinks. */
  age: number;
}

const radius = (t: Target): number => {
  const p = t.age / TARGET_LIFE_S; // 0..1
  return TARGET_MAX_R * Math.sin(Math.min(1, p) * Math.PI);
};

const isNum = (v: unknown): v is number => typeof v === "number";

function mount(card: GameCard): Cartridge {
  const wrap = document.createElement("div");
  wrap.className = "screen";
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${W}/${H}`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Aim Trainer range");
  wrap.appendChild(canvas);
  card.body.prepend(wrap);
  const scr = setupScreen(canvas, W, H);

  let best = store.get<number>("best:aim", 0, isNum);
  let timeLeft = ROUND_S;
  let hits = 0;
  let shots = 0;
  let spawnAcc = 0;
  let targets: Target[] = [];
  let over = false;
  let flash = 0; // brief green flash on hit (seconds left)
  let overTimer: ReturnType<typeof setTimeout> | null = null;

  const acc = (): number => (shots === 0 ? 100 : Math.round((hits / shots) * 100));

  function syncStats(): void {
    card.setStat("HITS", String(hits));
    card.setStat("ACC", `${acc()}%`);
    card.setStat("TIME", `${Math.ceil(timeLeft)}s`);
    card.setStat("BEST", String(best));
  }

  function resetRound(): void {
    timeLeft = ROUND_S;
    hits = 0;
    shots = 0;
    spawnAcc = 0;
    targets = [];
    over = false;
    syncStats();
  }

  function spawn(): void {
    targets.push({
      x: MARGIN + Math.random() * (W - MARGIN * 2),
      y: MARGIN + Math.random() * (H - MARGIN * 2),
      age: 0,
    });
  }

  function endRound(): void {
    over = true;
    if (hits > best) {
      best = hits;
      store.set("best:aim", best);
      card.flashStat("BEST");
    }
    syncStats();
    beep(392, 0.12);
    setTimeout(() => beep(262, 0.18), 130);
    overTimer = setTimeout(() => {
      overTimer = null;
      if (Hub.current === "aim") Hub.sleep();
      card.setVeil(`TIME! ${hits} HITS · ${acc()}% ACC`, "▶ CLICK TO GO AGAIN");
    }, 1400);
  }

  function update(dt: number): void {
    if (over) return;
    flash = Math.max(0, flash - dt);
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endRound();
      return;
    }
    spawnAcc += dt;
    if (spawnAcc >= SPAWN_EVERY_S && targets.length < MAX_TARGETS) {
      spawnAcc = 0;
      spawn();
    }
    for (const t of targets) t.age += dt;
    targets = targets.filter((t) => t.age < TARGET_LIFE_S);
    card.setStat("TIME", `${Math.ceil(timeLeft)}s`);
  }

  function render(): void {
    const { ctx } = scr;
    scr.clear();
    // crosshair grid corners
    ctx.fillStyle = flash > 0 ? "#04785722" : "#f4f4f5";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#e4e4e7";
    for (let y = 20; y < H; y += 40)
      for (let x = 20; x < W; x += 40) ctx.fillRect(x, y, 1, 1);
    for (const t of targets) {
      const r = radius(t);
      if (r < 1) continue;
      ctx.fillStyle = "#be185d";
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (r > 5) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(t.x, t.y, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#be185d";
        ctx.beginPath();
        ctx.arc(t.x, t.y, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (over) {
      ctx.fillStyle = "#18181b";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("TIME!", W / 2, H / 2 - 8);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`${hits} HITS · ${acc()}%`, W / 2, H / 2 + 10);
      ctx.textAlign = "left";
    }
  }

  const loop = createLoop({ update, render });

  wrap.addEventListener("pointerdown", (e: PointerEvent) => {
    if (Hub.current !== "aim" || over) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    shots++;
    let hit = false;
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (!t) continue;
      if (Math.hypot(x - t.x, y - t.y) <= Math.max(radius(t), 4)) {
        targets.splice(i, 1);
        hits++;
        hit = true;
        flash = 0.1;
        beep(880 + Math.min(500, hits * 12), 0.04);
        break;
      }
    }
    if (!hit) beep(220, 0.05, "square");
    syncStats();
  });

  syncStats();
  render(); // first paint under the veil

  return {
    // mouse game — claims no keys; the page keeps scrolling normally
    start() {
      if (overTimer) {
        clearTimeout(overTimer);
        overTimer = null;
      }
      if (over) resetRound();
      loop.start();
    },
    // state-preserving pause: the round clock freezes with the loop
    stop() {
      loop.stop();
    },
  };
}

export const def: CabinetDef = {
  options: {
    id: "aim",
    title: "AIM TRAINER",
    veilMsg: "▶ CLICK TO START",
    veilSub: "30 SECONDS ON THE CLOCK",
    stats: [
      { label: "HITS", value: "0" },
      { label: "ACC", value: "100%" },
      { label: "TIME", value: "30s" },
      { label: "BEST", value: "0" },
    ],
    pill: "SKILL",
    legend: [
      { keys: ["CLICK", "TAP"], desc: "Shoot a target before it shrinks away." },
      { keys: ["ESC"], desc: "Pause the clock, or exit fullscreen." },
      { keys: ["F"], desc: "Fullscreen (CSS takeover)." },
    ],
    legendNote:
      "PURE POINTER GAME — IT CLAIMS NO KEYS, SO ARROWS AND SPACE ALWAYS SCROLL THIS PAGE. " +
      "PAUSING FREEZES THE ROUND CLOCK.",
  },
  mount,
};
