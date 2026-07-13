/**
 * ticker.ts — fills the hub's scrolling stats ticker.
 *
 * The track holds two identical halves (#tick-a / #tick-b) so the CSS
 * translateX(-50%) loop is seamless. Text goes in via textContent.
 */

export function fillTicker(items: readonly string[]): void {
  for (const id of ["tick-a", "tick-b"]) {
    const half = document.getElementById(id);
    if (!half) continue;
    half.replaceChildren();
    for (const text of items) {
      const span = document.createElement("span");
      const star = document.createElement("i");
      star.textContent = "★";
      span.append(star, ` ${text}`);
      half.appendChild(span);
    }
  }
}
