/**
 * card.ts — builds the game-card DOM: head (title, LED, ⛶), body (+ veil),
 * stats foot, fs-hint, and an aria-live status line the Hub announces
 * through. Games mount into `body`; the Hub toggles .active/.fs and the
 * veil. All dynamic text goes through textContent (no variable innerHTML).
 */

/** Build-time constant — the ⛶ expand icon from the mockup. */
const FS_ICON_SVG =
  '<svg viewBox="0 0 10 10" width="12" height="12" fill="none" stroke="currentColor" ' +
  'stroke-width="1.5" aria-hidden="true"><path d="M1 4V1h3M9 6v3H6M6 1h3v3M4 9H1V6"/></svg>';

export interface StatSpec {
  label: string;
  value?: string;
}

export interface CardOptions {
  /** Game id — becomes data-game and the Hub registration id. */
  id: string;
  title: string;
  /** Span two hub-grid columns (.gcard--wide). */
  wide?: boolean;
  /** Center the body content (.gcard-body--center). */
  centerBody?: boolean;
  /** Idle game: no veil, LED always lit, not click-to-wake. */
  alwaysOn?: boolean;
  veilMsg?: string;
  veilSub?: string;
  stats?: StatSpec[];
  /** Right-aligned pill label in the foot (e.g. "RUNNER"). */
  pill?: string;
  ariaLabel?: string;
}

export interface GameCard {
  /** The .gcard element — pass to Hub.register. */
  root: HTMLElement;
  /** Mount the game surface here. */
  body: HTMLElement;
  /** Foot row — append custom controls if the stat row isn't enough. */
  foot: HTMLElement;
  veil: HTMLElement | null;
  setStat(label: string, value: string): void;
  /** Re-trigger the green .flash animation on a stat value (new best!). */
  flashStat(label: string): void;
  setVeil(msg: string, sub?: string): void;
}

const statKey = (label: string): string => label.toLowerCase().replace(/\s+/g, "-");

export function createCard(opts: CardOptions): GameCard {
  const root = document.createElement("article");
  root.className = "gcard" + (opts.wide ? " gcard--wide" : "") + (opts.alwaysOn ? " gcard--always-on" : "");
  root.dataset["game"] = opts.id;
  root.tabIndex = 0;
  root.setAttribute(
    "aria-label",
    opts.ariaLabel ?? `${opts.title} — ${opts.alwaysOn ? "always running" : "click to play"}`,
  );

  // ----- head -----
  const head = document.createElement("div");
  head.className = "gcard-head";
  const title = document.createElement("span");
  title.className = "gcard-title";
  title.textContent = opts.title;
  const led = document.createElement("span");
  led.className = "led";
  led.setAttribute("aria-hidden", "true");
  const fsBtn = document.createElement("button");
  fsBtn.className = "icon-btn fs-btn";
  fsBtn.type = "button";
  fsBtn.title = "Fullscreen (F)";
  fsBtn.setAttribute("aria-label", `Fullscreen ${opts.title}`);
  fsBtn.innerHTML = FS_ICON_SVG; // build-time constant
  head.append(title, led, fsBtn);

  // ----- body (+ veil) -----
  const body = document.createElement("div");
  body.className = "gcard-body" + (opts.centerBody ? " gcard-body--center" : "");

  let veil: HTMLElement | null = null;
  let veilMsgEl: HTMLElement | null = null;
  let veilSubEl: HTMLElement | null = null;
  if (!opts.alwaysOn) {
    veil = document.createElement("div");
    veil.className = "veil";
    veilMsgEl = document.createElement("div");
    veilMsgEl.className = "veil-msg";
    veilMsgEl.textContent = opts.veilMsg ?? "▶ CLICK TO PLAY";
    veil.appendChild(veilMsgEl);
    if (opts.veilSub) {
      veilSubEl = document.createElement("div");
      veilSubEl.className = "veil-sub";
      veilSubEl.textContent = opts.veilSub;
      veil.appendChild(veilSubEl);
    }
    body.appendChild(veil);
  }

  // ----- foot -----
  const foot = document.createElement("div");
  foot.className = "gcard-foot";
  const statEls = new Map<string, HTMLElement>();
  for (const s of opts.stats ?? []) {
    const span = document.createElement("span");
    span.className = "stat";
    span.append(`${s.label} `);
    const b = document.createElement("b");
    b.textContent = s.value ?? "0";
    span.appendChild(b);
    foot.appendChild(span);
    statEls.set(statKey(s.label), b);
  }
  if (opts.pill) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.style.marginLeft = "auto";
    pill.textContent = opts.pill;
    foot.appendChild(pill);
  }

  // ----- fs hint + aria-live status -----
  const fsHint = document.createElement("div");
  fsHint.className = "fs-hint";
  fsHint.textContent = "[ESC] EXIT FULLSCREEN";
  const status = document.createElement("span");
  status.className = "sr-only";
  status.setAttribute("data-status", "");
  status.setAttribute("aria-live", "polite");

  root.append(head, body, foot, fsHint, status);

  return {
    root,
    body,
    foot,
    veil,
    setStat(label, value) {
      const el = statEls.get(statKey(label));
      if (el) el.textContent = value;
    },
    flashStat(label) {
      const el = statEls.get(statKey(label));
      if (!el) return;
      el.classList.remove("flash");
      void el.offsetWidth; // restart the CSS animation
      el.classList.add("flash");
    },
    setVeil(msg, sub) {
      if (veilMsgEl) veilMsgEl.textContent = msg;
      if (sub !== undefined && veil) {
        if (!veilSubEl) {
          veilSubEl = document.createElement("div");
          veilSubEl.className = "veil-sub";
          veil.appendChild(veilSubEl);
        }
        veilSubEl.textContent = sub;
      }
    },
  };
}
