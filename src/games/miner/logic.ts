/**
 * logic.ts — pure Token Miner math (no DOM, no storage, no clocks).
 * Unit-tested: rates, costs, offline earnings with cap + clock-skew clamp.
 */

export interface MinerState {
  tokens: number;
  miners: number;
  /** Wall-clock ms of the last save — offline earnings are computed from it. */
  last: number;
}

/** Persisted shape validator for `arcade:miner:state`. */
export function isMinerState(v: unknown): v is MinerState {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o["tokens"] === "number" && typeof o["miners"] === "number" && typeof o["last"] === "number";
}

export const freshState = (now: number): MinerState => ({ tokens: 0, miners: 0, last: now });

/** Next-miner price: 15 · 1.15^owned, rounded up. */
export const cost = (miners: number): number => Math.ceil(15 * 1.15 ** miners);

/** Each miner produces one token per second. */
export const RATE_PER_MINER = 1;

/** Offline earnings accrue for at most 4 hours away. */
export const OFFLINE_CAP_S = 4 * 3600;

/**
 * Tokens earned while away: miners × seconds, capped at 4 h.
 * A clock that moved backwards (negative delta) earns exactly 0.
 */
export function offlineGain(state: MinerState, now: number): number {
  const awayS = Math.min(Math.max(0, (now - state.last) / 1000), OFFLINE_CAP_S);
  return state.miners * RATE_PER_MINER * awayS;
}

/** Fold offline earnings into a new state stamped at `now`. */
export function applyOffline(state: MinerState, now: number): { state: MinerState; gained: number } {
  const gained = offlineGain(state, now);
  return { state: { tokens: state.tokens + gained, miners: state.miners, last: now }, gained };
}

/** Attempt a miner purchase. Returns the same state when unaffordable. */
export function buyMiner(state: MinerState): { state: MinerState; bought: boolean } {
  const c = cost(state.miners);
  if (state.tokens < c) return { state, bought: false };
  return {
    state: { tokens: state.tokens - c, miners: state.miners + 1, last: state.last },
    bought: true,
  };
}
