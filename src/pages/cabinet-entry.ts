/**
 * cabinet-entry.ts — shared bootstrapper for every cabinet page.
 *
 * Cabinet HTML files are near-empty shells carrying only
 * `<body data-game="{id}">`; this entry looks the id up, dynamic-imports
 * the game module (each becomes its own chunk), renders the shared
 * scaffold, and registers the cartridge with the Hub. Cabinet chrome
 * therefore cannot drift between games.
 */
import "../styles/main.css";
import { Hub } from "../lib/hub";
import { createCabinet } from "../ui/cabinet";
import type { CabinetDef } from "../games/types";

const LOADERS: Record<string, () => Promise<{ def: CabinetDef }>> = {
  snake: () => import("../games/snake/snake"),
};

const root = document.getElementById("app");
const id = document.body.dataset["game"] ?? "";
const load = LOADERS[id];
if (!root) throw new Error("cabinet-entry: missing #app");
if (!load) throw new Error(`cabinet-entry: unknown cabinet "${id}"`);

void load().then(({ def }) => {
  const page = createCabinet(root, def.options);
  const cart = def.mount(page.card);
  Hub.register(def.options.id, cart, page.card.root);
});
