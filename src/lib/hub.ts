/**
 * hub.ts — per-page singleton owning wake/sleep, CSS fullscreen, and ALL
 * global input routing (ADR-2, ADR-3).
 *
 * THE key-routing invariant (PRD FR-2.5 — the #1 flagged bug class):
 * this module is the ONLY code that attaches document-level key/mouse
 * listeners and the ONLY caller of preventDefault on navigation keys.
 * On keydown:
 *   1. Escape            → exit fullscreen if in it, else sleep the game
 *   2. unmodified f / F  → toggle CSS fullscreen (only with a game awake)
 *   3. awake game claims e.key → preventDefault + api.onKey(e.key)
 *   4. awake game + unclaimed nav key (arrows/space) → preventDefault only
 *   5. otherwise NEVER preventDefault — the page must scroll normally
 * When no game is awake, arrow keys always scroll the page.
 */

import type { Cartridge } from "./cartridge";
import { beep } from "./audio";
import { coverScreen, revealScreen } from "./wipe";

const NAV_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "];

interface Entry {
  id: string;
  api: Cartridge;
  card: HTMLElement;
  veil: HTMLElement | null;
  veilMsg: HTMLElement | null;
  status: HTMLElement | null; // aria-live line owned by card.ts
}

const games = new Map<string, Entry>();
let cur: string | null = null;
let fsId: string | null = null;
let listenersAttached = false;
let wakeGate: ((id: string, card: HTMLElement) => boolean | Promise<boolean>) | null = null;

function announce(g: Entry, text: string): void {
  if (g.status) g.status.textContent = text;
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (fsId) Hub.exitFs();
    else Hub.sleep();
    return;
  }
  if ((e.key === "f" || e.key === "F") && cur && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    Hub.toggleFs(cur);
    return;
  }
  if (cur) {
    const g = games.get(cur);
    if (!g) return;
    if (g.api.keys?.includes(e.key) && g.api.onKey) {
      e.preventDefault();
      g.api.onKey(e.key);
    } else if (NAV_KEYS.includes(e.key)) {
      // an awake game swallows nav keys it doesn't use, so the page under
      // it doesn't scroll mid-game…
      e.preventDefault();
    }
    // …but NOTHING else is ever prevented.
  }
}

function onDocumentMousedown(e: MouseEvent): void {
  // click anywhere outside the active card = pause
  if (!cur) return;
  const g = games.get(cur);
  if (g && e.target instanceof Node && !g.card.contains(e.target)) Hub.sleep();
}

/** The actual wake, after any gate has approved it. */
function doWake(id: string): void {
  const g = games.get(id);
  if (!g) return;
  Hub.sleep();
  cur = id;
  g.card.classList.add("active");
  g.veil?.classList.add("hidden");
  g.api.start();
  beep(660, 0.05);
  announce(g, "Playing. Press Escape to pause.");
  g.card.focus({ preventScroll: true });
}

/**
 * Consult the wake gate for `id`, running `onApproved` only if it allows the start.
 *
 * The gate may answer synchronously (no token layer, or an already-known verdict) or
 * asynchronously (a spend request in flight). Once it approves, the start proceeds
 * unconditionally — the player has already been charged at that point, so backing out
 * because they clicked elsewhere meanwhile would take tokens and give nothing.
 *
 * A declined start changes nothing here; showing the player *why* is the gate's own
 * job, since only it knows the reason.
 */
function runGate(id: string, onApproved: () => void): void {
  const g = games.get(id);
  if (!g) return;

  if (!wakeGate) {
    onApproved();
    return;
  }

  const verdict = wakeGate(id, g.card);
  if (typeof verdict === "boolean") {
    if (verdict) onApproved();
    return;
  }
  void verdict.then((ok) => {
    if (ok) onApproved();
  });
}

/** Wake `id` if the gate allows. */
function gatedWake(id: string): void {
  const g = games.get(id);
  if (!g || g.api.alwaysOn || cur === id) return;
  runGate(id, () => doWake(id));
}

/** Apply the CSS-takeover fullscreen classes. Assumes the game is awake or alwaysOn. */
function applyFs(id: string): void {
  const g = games.get(id);
  if (!g) return;
  g.card.classList.add("fs");
  document.body.classList.add("has-fs");
  fsId = id;
  announce(g, "Fullscreen. Press Escape to exit.");
}

function ensureListeners(): void {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;
  document.addEventListener("keydown", onDocumentKeydown);
  document.addEventListener("mousedown", onDocumentMousedown);
}

export const Hub = {
  /**
   * Register a cartridge with its card element. The card is expected to
   * carry the structure built by src/ui/card.ts (.veil, .veil-msg, .led,
   * .fs-btn, [data-status]); missing pieces are tolerated.
   */
  register(id: string, api: Cartridge, card: HTMLElement): void {
    ensureListeners();
    const entry: Entry = {
      id,
      api,
      card,
      veil: card.querySelector<HTMLElement>(".veil"),
      veilMsg: card.querySelector<HTMLElement>(".veil-msg"),
      status: card.querySelector<HTMLElement>("[data-status]"),
    };
    games.set(id, entry);

    if (!api.alwaysOn) {
      // wake interactions live on the card, not on document
      card.addEventListener("mousedown", () => {
        if (cur !== id) Hub.wake(id);
      });
      card.addEventListener("keydown", (e: KeyboardEvent) => {
        const veiled = entry.veil !== null && !entry.veil.classList.contains("hidden");
        if ((e.key === "Enter" || e.key === " ") && cur !== id && veiled) {
          e.preventDefault();
          Hub.wake(id);
        }
      });
    } else {
      card.classList.add("gcard--always-on");
    }

    const fsBtn = card.querySelector<HTMLElement>(".fs-btn");
    if (fsBtn) {
      fsBtn.addEventListener("mousedown", (e) => e.stopPropagation());
      fsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        Hub.toggleFs(id);
      });
    }

    if (api.alwaysOn) api.start();
  },

  /**
   * Install a gate consulted before any wake (token spend-before-play, FR-4.1).
   *
   * Opt-in and unset by default, so with no gate installed the wake path behaves exactly
   * as it did before tokens existed. A gate returning false — or resolving false —
   * cancels the wake silently; showing the player *why* is the gate's own job, since only
   * it knows the reason.
   *
   * Deliberately narrow: the gate cannot wake a game, only decline one, so it can never
   * become a second entry point into the key-routing invariant this module owns.
   */
  setWakeGate(gate: ((id: string, card: HTMLElement) => boolean | Promise<boolean>) | null): void {
    wakeGate = gate;
  },

  /** Wake a game — sleeps the current non-alwaysOn game first. */
  wake(id: string): void {
    gatedWake(id);
  },

  /** Pause the current game; veil back on. State is preserved (Cartridge.stop). */
  sleep(): void {
    if (!cur) return;
    const g = games.get(cur);
    cur = null;
    if (!g) return;
    g.api.stop();
    g.card.classList.remove("active");
    if (g.veil) {
      g.veil.classList.remove("hidden");
      if (g.veilMsg) g.veilMsg.textContent = "PAUSED · CLICK TO RESUME";
    }
    announce(g, "Paused.");
  },

  /** CSS-takeover fullscreen (.fs + body.has-fs) — NOT the Fullscreen API. */
  toggleFs(id: string): void {
    if (fsId === id) {
      Hub.exitFs();
      return;
    }
    const g = games.get(id);
    if (!g) return;

    // The transition itself, once the start is paid for. Waking inside the wipe keeps
    // the game's first frame hidden behind the cover, and tearing down a previous
    // fullscreen here rather than calling exitFs() keeps it to a single wipe.
    // doWake() rather than Hub.wake(), which would consult the gate a second time and
    // charge twice.
    const enterFs = (): void => {
      void coverScreen().then(() => {
        if (fsId) {
          const prev = games.get(fsId);
          prev?.card.classList.remove("fs");
          document.body.classList.remove("has-fs");
          fsId = null;
        }
        if (!g.api.alwaysOn && cur !== id) doWake(id);
        applyFs(id);
        void revealScreen();
      });
    };

    // Already playable — nothing to gate.
    if (g.api.alwaysOn || cur === id) {
      enterFs();
      return;
    }

    // A veiled game entering fullscreen is still a game start, so it goes through the
    // same gate as a click, or ⛶ would be a free way to start a paid game. Gating
    // before the wipe rather than inside it means a declined spend leaves the screen
    // untouched and never covers the veil explaining why.
    runGate(id, enterFs);
  },

  exitFs(): void {
    if (!fsId) return;
    const g = games.get(fsId);
    void coverScreen().then(() => {
      fsId = null;
      if (!g) return;
      g.card.classList.remove("fs");
      document.body.classList.remove("has-fs");
      announce(g, "Left fullscreen.");
      void revealScreen();
    });
  },

  /** Id of the awake game, or null. alwaysOn games are never "current". */
  get current(): string | null {
    return cur;
  },

  /** Id of the fullscreened game, or null. */
  get fullscreen(): string | null {
    return fsId;
  },
};

// dev-only introspection handle (tech-design "Observability")
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>)["__arcade"] = Hub;
}
