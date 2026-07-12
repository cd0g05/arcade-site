/**
 * demo.ts (page entry) — the demo cartridge page. Throwaway: proves the
 * wake/sleep/veil/fullscreen/key-routing contract end-to-end on the real
 * scaffold before the game partitions build on it.
 */
import "../styles/main.css";
import { Hub } from "../lib/hub";
import { createCabinet } from "../ui/cabinet";
import { mountDemo } from "../games/demo/demo";
import { SPRITES } from "../sprites/generated";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

const { card, main } = createCabinet(root, {
  id: "demo",
  title: "DEMO ROVER",
  subtitle: "carter's arcade · foundation test cartridge",
  veilMsg: "▶ CLICK TO START",
  veilSub: "[ARROWS] STEER · [SPACE] BRAKE",
  stats: [
    { label: "SCORE", value: "0" },
    { label: "BEST", value: "0" },
  ],
  pill: "THROWAWAY",
  legend: [
    { keys: ["CLICK"], desc: "Wake the rover. Click anywhere else to pause it." },
    { keys: ["ESC"], desc: "Pause, or exit fullscreen." },
    { keys: ["F"], desc: "Fullscreen (CSS takeover — or use the corner button)." },
    { keys: ["ARROWS", "WASD"], desc: "Steer." },
    { keys: ["SPACE"], desc: "Toggle the brake." },
    { keys: ["SWIPE", "TAP"], desc: "Steer / brake on touch." },
  ],
  legendNote:
    "KEY-ROUTING CONTRACT: ARROWS ONLY GET CAPTURED WHILE THE ROVER IS AWAKE — " +
    "THE PAGE ALWAYS SCROLLS NORMALLY OTHERWISE. PAUSE PRESERVES STATE.",
});

// decorate the header with a pipeline sprite (proves generated.ts in situ)
const logo = document.querySelector(".logo");
if (logo) {
  const spr = document.createElement("span");
  spr.innerHTML = SPRITES.joystick; // build-time constant
  spr.firstElementChild?.setAttribute("style", "width:30px;height:auto");
  logo.prepend(spr.firstElementChild ?? spr);
}

const demo = mountDemo(card);
Hub.register("demo", demo.api, card.root);

// tall spacer so arrow-key scrolling is actually observable on this page
const spacer = document.createElement("section");
spacer.className = "sec";
const panel = document.createElement("div");
panel.className = "panel";
const h3 = document.createElement("h3");
h3.textContent = "SCROLL TEST AREA";
panel.appendChild(h3);
for (let i = 0; i < 12; i++) {
  const p = document.createElement("p");
  p.className = "tiny";
  p.textContent =
    `${String(i + 1).padStart(2, "0")} — WITH THE ROVER ASLEEP, ARROW KEYS AND SPACE MUST ` +
    "SCROLL THIS PAGE. WAKE IT AND THEY STEER INSTEAD. CLICK AWAY TO GET YOUR SCROLL BACK.";
  panel.appendChild(p);
}
spacer.appendChild(panel);
main.appendChild(spacer);
