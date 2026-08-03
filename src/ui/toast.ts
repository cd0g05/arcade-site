/**
 * toast.ts — the transient award notification (UX Mock-Up 2, tasks.md id:83).
 *
 * One `aria-live="polite"` region reused for every toast rather than one node per award:
 * a screen reader announces changes to a live region it already knows about, whereas
 * inserting a fresh region per toast is unreliable across readers.
 *
 * Motion is opt-out, not opt-in — `prefers-reduced-motion` swaps the slide for a fade
 * (UX Responsive & Accessibility). That is enforced in CSS so it also holds if a toast is
 * rendered by anything other than this module.
 */

const VISIBLE_MS = 3000;

let region: HTMLElement | null = null;
let hideTimer: number | undefined;

function ensureRegion(host: HTMLElement): HTMLElement {
  if (region?.isConnected) return region;
  const el = document.createElement('div');
  el.className = 'token-toast hidden';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  host.appendChild(el);
  region = el;
  return el;
}

/**
 * Show one award, e.g. `+15 High Score: Dino Run`.
 *
 * Uses textContent throughout — `reason` is server-supplied copy and this site's
 * convention is no variable innerHTML anywhere (see src/ui/card.ts).
 */
export function showAward(host: HTMLElement, amount: number, reason: string): void {
  const el = ensureRegion(host);
  el.textContent = '';

  const amt = document.createElement('span');
  amt.className = amount < 0 ? 'token-toast-amt neg' : 'token-toast-amt';
  amt.textContent = amount > 0 ? `+${amount}` : String(amount);

  const text = document.createElement('span');
  text.textContent = ` ${reason}`;

  el.append(amt, text);
  el.classList.remove('hidden');

  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => el.classList.add('hidden'), VISIBLE_MS);
}

/**
 * Queue several awards so each is announced separately.
 *
 * One submission can trigger multiple awards at once — an interval-gap achievement
 * clearing several multiples, or participation plus a high score. Rendering only the last
 * one would silently swallow tokens the player actually earned.
 */
export function showAwards(
  host: HTMLElement,
  awards: Array<{ amount: number; reason: string }>,
): void {
  awards.forEach((award, i) => {
    window.setTimeout(
      () => showAward(host, award.amount, award.reason),
      i * (VISIBLE_MS + 200),
    );
  });
}

/** Test seam — drops the cached region so a fresh DOM starts clean. */
export function resetToast(): void {
  window.clearTimeout(hideTimer);
  region = null;
}
