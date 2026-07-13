/**
 * style-guide.ts (page entry) — design-tokens reference page.
 *
 * Static content lives in style-guide/index.html; this entry loads the
 * style system, stamps the daily number, and renders the sprite sheet
 * from the pipeline so the page always reflects src/sprites/maps.ts.
 */
import "../styles/main.css";
import { SPRITES } from "../sprites/generated";

const sheet = document.getElementById("spr-sheet");
if (sheet) {
  for (const svg of Object.values(SPRITES)) {
    const holder = document.createElement("span");
    holder.innerHTML = svg; // build-time constants from the sprite pipeline
    const el = holder.firstElementChild;
    if (el) sheet.appendChild(el);
  }
}

const now = new Date();
const doy = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
document.querySelectorAll(".daily-num").forEach((el) => (el.textContent = `#${doy}`));
