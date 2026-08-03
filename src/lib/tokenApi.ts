/**
 * tokenApi.ts — the ONLY module that talks to the token backend.
 *
 * Design rule for this whole partition: **the arcade must work without it.** The token
 * economy is a layer on top of an already-complete site, so every function here resolves
 * to a typed "unavailable" result rather than throwing. A backend outage, a signed-out
 * visitor, and a missing API base URL are all the same thing to a caller — no tokens
 * available — and none of them may break gameplay (approach.md Risks & Mitigations).
 *
 * Requests send credentials because the backend authenticates with an Auth.js session
 * cookie and CORS-allow-lists this origin (arcade-backend/lib/cors.ts).
 */

/** Backend origin. Empty string disables every call, which is the correct dev default. */
const API_BASE = (import.meta.env['VITE_TOKEN_API_BASE'] as string | undefined) ?? '';

// Unset is the right default in dev and a misconfiguration in a production build, and the
// two are indistinguishable from the outside: the widget's `off` state hides itself
// deliberately, so a forgotten variable looks exactly like a site that never had tokens.
// Say so once in the console rather than letting someone conclude the deploy is broken.
if (import.meta.env.PROD && API_BASE === '') {
  console.warn(
    '[tokens] VITE_TOKEN_API_BASE was not set when this bundle was built, so the token ' +
      'layer is disabled and its UI is hidden. Vite inlines this value at BUILD time — ' +
      'setting it in the hosting dashboard only takes effect on the next build, and a ' +
      '"redeploy" of an existing build may reuse the old value.',
  );
}

/** Requests are abandoned rather than left hanging — a slow backend must not stall play. */
const TIMEOUT_MS = 6000;

export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'signed-out' }
  | { status: 'unavailable' };

export interface Transaction {
  id: string;
  amount: number;
  reason: string;
  source: string;
  createdAt: string;
}

export interface Award {
  amount: number;
  reason: string;
  source: string;
}

export interface BalanceResponse {
  balance: number;
  recent: Transaction[];
}

export interface ContentItem {
  id: string;
  type: 'riddle' | 'trivia' | 'task';
  prompt: string;
  award: number;
  completedToday: boolean;
}

export type SpendResult =
  | { outcome: 'spent'; newBalance: number }
  | { outcome: 'insufficient'; required: number; balance: number }
  | { outcome: 'unavailable' };

export function tokensConfigured(): boolean {
  return API_BASE !== '';
}

export function signInUrl(): string {
  return `${API_BASE}/api/auth/signin`;
}

export function signOutUrl(): string {
  return `${API_BASE}/api/auth/signout`;
}

/** Discord account linking reuses Auth.js's provider sign-in (FR-1.2). */
export function linkDiscordUrl(): string {
  return `${API_BASE}/api/auth/signin/discord`;
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  if (!tokensConfigured()) return { status: 'unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });

    // 401 is a normal state, not an error: most visitors are signed out.
    if (res.status === 401) return { status: 'signed-out' };
    if (!res.ok) return { status: 'unavailable' };

    return { status: 'ok', data: (await res.json()) as T };
  } catch {
    // Network failure, CORS rejection, timeout, malformed JSON — all indistinguishable
    // to the player and all handled the same way: the site carries on without tokens.
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export function getBalance(): Promise<ApiResult<BalanceResponse>> {
  return request<BalanceResponse>('/api/balance');
}

/**
 * Deduct a game's cost before play (FR-4.1).
 *
 * `insufficient` is deliberately distinct from `unavailable`: the first must block the
 * game and show the "Need {N} tokens" veil, while the second must let the game start.
 * Collapsing them would make an outage look like bankruptcy and lock players out.
 */
export async function spend(slug: string): Promise<SpendResult> {
  if (!tokensConfigured()) return { outcome: 'unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/spend`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: slug }),
      signal: controller.signal,
    });

    if (res.status === 402) {
      const body = (await res.json()) as { required?: number; balance?: number };
      return {
        outcome: 'insufficient',
        required: body.required ?? 0,
        balance: body.balance ?? 0,
      };
    }
    if (!res.ok) return { outcome: 'unavailable' };

    const body = (await res.json()) as { newBalance?: number };
    return { outcome: 'spent', newBalance: body.newBalance ?? 0 };
  } catch {
    return { outcome: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export function submitScore(
  slug: string,
  score: number,
): Promise<ApiResult<{ recorded: true; awards: Award[] }>> {
  return request('/api/scores/submit', {
    method: 'POST',
    body: { gameId: slug, score },
  });
}

export function getContent(): Promise<ApiResult<{ items: ContentItem[] }>> {
  return request('/api/content');
}

export function completeContent(
  contentItemId: string,
  answerText: string,
): Promise<ApiResult<{ ok: boolean; awarded?: number; error?: string }>> {
  return request('/api/content/complete', {
    method: 'POST',
    body: { contentItemId, answerText },
  });
}
