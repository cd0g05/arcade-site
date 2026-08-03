/**
 * balance.ts — the header token widget (UX Mock-Up 2, tasks.md ids 81-82).
 *
 * Four states, because the token layer can be absent for four different reasons and the
 * player deserves to know which:
 *   - `off`       — no backend configured for this build; render nothing at all, so the
 *                   pre-token site looks exactly as it did
 *   - `signed-out`— "Sign in with Google"
 *   - `loading`   — pill with the pulsing LED (reuses the site's existing LED convention)
 *   - `ready`     — pill with the balance
 *   - `degraded`  — signed in but the backend is unreachable; the pill stays, dimmed,
 *                   rather than vanishing and making the player think they lost tokens
 */
import { tokensConfigured, signInUrl } from '../lib/tokenApi';

export type BalanceState = 'off' | 'signed-out' | 'loading' | 'ready' | 'degraded';

export interface BalanceWidget {
  root: HTMLElement;
  /** Toast host — the pill's positioning context, per UX Mock-Up 2. */
  toastHost: HTMLElement;
  setState(state: BalanceState, balance?: number): void;
}

export function createBalanceWidget(host: HTMLElement): BalanceWidget {
  const root = document.createElement('div');
  root.className = 'token-widget';

  const signIn = document.createElement('a');
  signIn.className = 'button button-secondary token-signin';
  signIn.textContent = 'SIGN IN';
  signIn.href = tokensConfigured() ? signInUrl() : '#';

  const pill = document.createElement('span');
  pill.className = 'pill token-pill';

  const led = document.createElement('span');
  led.className = 'token-led';

  const value = document.createElement('b');
  value.className = 'token-value';

  pill.append(led, value);
  root.append(signIn, pill);
  host.appendChild(root);

  const setState = (state: BalanceState, balance?: number): void => {
    root.dataset['state'] = state;

    if (state === 'off') {
      root.hidden = true;
      return;
    }
    root.hidden = false;

    signIn.hidden = state !== 'signed-out';
    pill.hidden = state === 'signed-out';
    led.classList.toggle('loading', state === 'loading');
    pill.classList.toggle('degraded', state === 'degraded');

    if (state === 'ready' && typeof balance === 'number') {
      value.textContent = String(balance);
      // The pill is a compact glyph+number, so the accessible name carries the meaning.
      pill.setAttribute('aria-label', `Token balance: ${balance}`);
    } else if (state === 'loading') {
      value.textContent = '…';
      pill.setAttribute('aria-label', 'Token balance loading');
    } else if (state === 'degraded') {
      value.textContent = '—';
      pill.setAttribute('aria-label', 'Token balance unavailable');
    }
  };

  setState(tokensConfigured() ? 'loading' : 'off');

  return { root, toastHost: root, setState };
}
