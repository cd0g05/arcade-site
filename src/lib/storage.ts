/**
 * storage.ts — the ONLY module allowed to touch localStorage (ADR-4).
 *
 * - Every key is namespaced under the `arcade:` prefix.
 * - Values are JSON; reads are tolerant: any missing value, parse failure,
 *   quota error, or shape-validation failure returns the caller's fallback.
 *   Corrupt storage must never crash a game.
 * - clearAll() removes ONLY `arcade:*` keys.
 */

const PREFIX = "arcade:";

const observers = new Set<(key: string, value: unknown) => void>();

function notify(key: string, value: unknown): void {
  for (const fn of observers) {
    try {
      fn(key, value);
    } catch {
      // A broken observer must not take down the game that wrote the value.
    }
  }
}

export const store = {
  /**
   * Read a JSON value. Returns `fallback` if the key is missing, the JSON is
   * corrupt, storage is unavailable, or `validate` (when given) rejects the
   * parsed value.
   */
  get<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      const parsed: unknown = JSON.parse(raw);
      if (validate && !validate(parsed)) {
        console.warn(`arcade storage: rejected shape for "${key}"`);
        return fallback;
      }
      return parsed as T;
    } catch {
      return fallback;
    }
  },

  /** Write a JSON value. Failures (quota, private mode) are swallowed. */
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* best-effort persistence */
    }
    notify(key, value);
  },

  /**
   * Subscribe to writes (token score submission, FR-3.1).
   *
   * Every game already funnels its personal best through `set("best:{game}", n)` — this
   * module is the only one allowed to touch localStorage (ADR-4), so that is the one
   * place all twelve score-save paths converge. Observing here submits scores without
   * editing a single game, which is what keeps this partition's promise that no existing
   * game logic changes (approach.md Migrations & Compat).
   *
   * Observers are notified after the write and must never throw — a listener failure
   * cannot be allowed to break the game that triggered it.
   *
   * @returns an unsubscribe function.
   */
  observe(fn: (key: string, value: unknown) => void): () => void {
    observers.add(fn);
    return () => observers.delete(fn);
  },

  /** Remove one arcade key. */
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },

  /** Remove every `arcade:*` key — and nothing else. */
  clearAll(): void {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k !== null && k.startsWith(PREFIX)) doomed.push(k);
      }
      for (const k of doomed) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};
