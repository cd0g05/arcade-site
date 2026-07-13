/**
 * cabinet.ts — shared cabinet page scaffold. Cabinet HTML entries are
 * near-empty shells; this renders the chrome (header with ← HUB, the game
 * card/screen, controls legend, footer) so cabinet pages cannot drift.
 */

import { soundEnabled, toggleSound, beep } from "../lib/audio";
import { createCard, type GameCard, type StatSpec } from "./card";

export interface LegendRow {
  /** Key names rendered as <kbd> chips, e.g. ["ARROWS", "WASD"]. */
  keys: string[];
  desc: string;
}

export interface CabinetOptions {
  /** Game id (Hub registration id / data-game). */
  id: string;
  title: string;
  /** Header subline, e.g. "cartercripe.com/arcade · cabinet". */
  subtitle?: string;
  veilMsg?: string;
  veilSub?: string;
  stats?: StatSpec[];
  pill?: string;
  legend?: LegendRow[];
  /** Extra fine-print under the legend. */
  legendNote?: string;
}

export interface CabinetPage {
  /** The game card — mount the game in card.body, register card.root. */
  card: GameCard;
  main: HTMLElement;
}

export function createCabinet(root: HTMLElement, opts: CabinetOptions): CabinetPage {
  // ----- header -----
  const header = document.createElement("header");
  header.className = "top";
  const inner = document.createElement("div");
  inner.className = "container top-inner";

  const logo = document.createElement("div");
  logo.className = "logo";
  const logoText = document.createElement("div");
  const h1 = document.createElement("h1");
  h1.className = "site";
  h1.textContent = opts.title;
  const sub = document.createElement("div");
  sub.className = "site-sub";
  sub.textContent = opts.subtitle ?? "carter's arcade · cabinet";
  logoText.append(h1, sub);
  logo.appendChild(logoText);

  const ctrl = document.createElement("div");
  ctrl.className = "top-ctrl";
  const sndBtn = document.createElement("button");
  sndBtn.className = "button button-secondary";
  sndBtn.type = "button";
  const renderSnd = (): void => {
    sndBtn.textContent = `SND:${soundEnabled() ? "ON" : "OFF"}`;
  };
  sndBtn.addEventListener("click", () => {
    if (toggleSound()) beep(880, 0.06);
    renderSnd();
  });
  renderSnd();
  const back = document.createElement("a");
  back.className = "button button-secondary back-hub";
  back.href = "/";
  back.textContent = "← HUB";
  ctrl.append(sndBtn, back);

  inner.append(logo, ctrl);
  header.appendChild(inner);

  // ----- main: card + legend -----
  const main = document.createElement("main");
  main.className = "container cabinet-main";

  const gameSec = document.createElement("section");
  gameSec.className = "sec";
  const card = createCard({
    id: opts.id,
    title: opts.title,
    veilMsg: opts.veilMsg ?? "▶ CLICK TO START",
    ...(opts.veilSub !== undefined ? { veilSub: opts.veilSub } : {}),
    ...(opts.stats !== undefined ? { stats: opts.stats } : {}),
    ...(opts.pill !== undefined ? { pill: opts.pill } : {}),
  });
  gameSec.appendChild(card.root);
  main.appendChild(gameSec);

  if (opts.legend?.length) {
    const legendSec = document.createElement("section");
    legendSec.className = "sec";
    const panel = document.createElement("div");
    panel.className = "panel";
    const h2 = document.createElement("h2");
    h2.className = "panel-heading";
    h2.textContent = "CONTROLS";
    panel.appendChild(h2);
    for (const row of opts.legend) {
      const div = document.createElement("div");
      div.className = "help-row";
      const k = document.createElement("span");
      k.className = "k";
      row.keys.forEach((key, i) => {
        if (i > 0) k.append(" / ");
        const kbd = document.createElement("kbd");
        kbd.textContent = key;
        k.appendChild(kbd);
      });
      const desc = document.createElement("span");
      desc.textContent = row.desc;
      div.append(k, desc);
      panel.appendChild(div);
    }
    if (opts.legendNote) {
      const note = document.createElement("p");
      note.className = "tiny";
      note.textContent = opts.legendNote;
      panel.appendChild(note);
    }
    legendSec.appendChild(panel);
    main.appendChild(legendSec);
  }

  // ----- footer -----
  const footer = document.createElement("footer");
  const fContainer = document.createElement("div");
  fContainer.className = "container";
  const fP = document.createElement("p");
  fP.textContent = "HANDMADE PIXELS, NO ENGINES.";
  fContainer.appendChild(fP);
  footer.appendChild(fContainer);

  root.replaceChildren(header, main, footer);
  return { card, main };
}
