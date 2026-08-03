/**
 * tokens.ts — wires the token layer into the existing arcade (tasks.md ids 84-86).
 *
 * This is the only module that knows about *both* the site and the backend. Everything it
 * touches is additive and reversible: not calling `initTokens()` leaves the arcade exactly
 * as it was before this partition.
 *
 * Three integration points, deliberately narrow:
 *   1. a Hub wake gate         — spend before play
 *   2. a storage observer      — submit scores on a new personal best
 *   3. the header widget       — balance + award toasts
 */
import { Hub } from './hub';
import { store } from './storage';
import { gameByBestKey, gameByHubId } from './tokenGames';
import * as api from './tokenApi';
import { createBalanceWidget, type BalanceWidget } from '../ui/balance';
import { showAwards } from '../ui/toast';

/** How long the "Need N tokens" veil message stays before the veil reverts. */
const VEIL_MS = 2200;

type Session = 'unknown' | 'signed-in' | 'signed-out' | 'unavailable';

let widget: BalanceWidget | null = null;
let session: Session = 'unknown';
let balance = 0;

function setVeilMessage(card: HTMLElement, text: string): void {
  const veilMsg = card.querySelector<HTMLElement>('.veil-msg');
  if (!veilMsg) return;

  const previous = veilMsg.textContent ?? '';
  veilMsg.textContent = text;

  // Restored rather than left in place: the veil's default copy is "CLICK TO PLAY", and
  // leaving a stale "NEED 3 TOKENS" there after the player earns more would be a lie.
  window.setTimeout(() => {
    if (veilMsg.textContent === text) veilMsg.textContent = previous;
  }, VEIL_MS);
}

function render(): void {
  if (!widget) return;
  if (!api.tokensConfigured()) return widget.setState('off');
  if (session === 'signed-out') return widget.setState('signed-out');
  if (session === 'unavailable') return widget.setState('degraded');
  if (session === 'unknown') return widget.setState('loading');
  widget.setState('ready', balance);
}

async function refreshBalance(): Promise<void> {
  const result = await api.getBalance();
  if (result.status === 'ok') {
    session = 'signed-in';
    balance = result.data.balance;
  } else if (result.status === 'signed-out') {
    session = 'signed-out';
  } else {
    session = 'unavailable';
  }
  render();
}

/**
 * The spend-before-play gate (FR-4.1).
 *
 * Returns true — let the game start — for every case except a confirmed insufficient
 * balance. A signed-out visitor, an unreachable backend, and a game the backend doesn't
 * know about all play for free, because the arcade predates the token economy and must
 * keep working without it.
 */
async function wakeGate(hubId: string, card: HTMLElement): Promise<boolean> {
  const game = gameByHubId(hubId);
  if (!game || !api.tokensConfigured() || session === 'signed-out') return true;

  const result = await api.spend(game.slug);

  if (result.outcome === 'insufficient') {
    // Exact UX copy. Note this does NOT focus the card — per tasks.md id:85 the veil must
    // not steal keyboard focus from whatever the player is actually doing.
    setVeilMessage(card, `NEED ${result.required} TOKENS`);
    balance = result.balance;
    session = 'signed-in';
    render();
    return false;
  }

  if (result.outcome === 'spent') {
    session = 'signed-in';
    balance = result.newBalance;
    // No toast for a spend — the pill ticking down is the feedback, and a toast here
    // would fire on every single game start. Toasts are reserved for earns.
    render();
    return true;
  }

  // 'unavailable' — an outage, or a signed-out visitor whose spend 401'd. Play on.
  //
  // Only an as-yet-unknown session degrades: a known signed-out one must keep showing
  // "SIGN IN" rather than a dimmed pill, and a known signed-in one shouldn't lose its
  // last-good balance over one failed request.
  if (session === 'unknown') session = 'unavailable';
  render();
  return true;
}

/**
 * Submit a new personal best and toast whatever it earned.
 *
 * Fired from a storage write, so it must never reject into the caller: the game that set
 * the value is mid-frame and does not care about the network.
 */
async function onBestWritten(key: string, value: unknown): Promise<void> {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
  const game = gameByBestKey(key);
  if (!game || !api.tokensConfigured() || session === 'signed-out') return;

  const result = await api.submitScore(game.slug, Math.floor(value));
  if (result.status !== 'ok') return;

  session = 'signed-in';
  if (result.data.awards.length > 0 && widget) {
    showAwards(widget.toastHost, result.data.awards);
    // Awards changed the balance; re-read rather than summing locally, so the pill agrees
    // with the ledger even if something else (a bot submission, an admin adjustment)
    // moved it in the meantime.
    void refreshBalance();
  }
}

/**
 * Mount the token layer. Safe to call on any page; safe to never call at all.
 *
 * @param host element the balance widget is appended to (the header control cluster).
 */
export function initTokens(host: HTMLElement | null): void {
  if (!host) return;

  widget = createBalanceWidget(host);
  render();

  if (!api.tokensConfigured()) return;

  Hub.setWakeGate(wakeGate);
  store.observe((key, value) => {
    void onBestWritten(key, value);
  });

  void refreshBalance();
}

/** Test seam. */
export function __resetTokens(): void {
  widget = null;
  session = 'unknown';
  balance = 0;
  Hub.setWakeGate(null);
}
