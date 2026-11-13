import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMyanmar } from "@remotion/google-fonts/NotoSansMyanmar";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadLilita } from "@remotion/google-fonts/LilitaOne";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import type { Template } from "./templates";

// Loaded once per page/render. Remotion waits for them before capturing frames.
const poppins = loadPoppins("normal", { weights: ["500", "600", "700", "800", "900"], subsets: ["latin"] });
const myanmar = loadMyanmar("normal", { weights: ["500", "700", "800", "900"], subsets: ["myanmar"] });
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const lilita = loadLilita("normal", { weights: ["400"], subsets: ["latin"] });
const playfair = loadPlayfair("normal", { weights: ["600", "800"], subsets: ["latin"] });
const playfairItalic = loadPlayfair("italic", { weights: ["600"], subsets: ["latin"] });
const caveat = loadCaveat("normal", { weights: ["700"], subsets: ["latin"] });
const bebas = loadBebas("normal", { weights: ["400"], subsets: ["latin"] });
void playfairItalic;

// Every stack ends with Noto Sans Myanmar so Burmese always renders.
const mm = `${myanmar.fontFamily}, sans-serif`;
export const FONT_BODY = `${poppins.fontFamily}, ${mm}`;
export const FONT_IMPACT = `${anton.fontFamily}, ${mm}`;
export const FONT_FUN = `${lilita.fontFamily}, ${mm}`;
export const FONT_SERIF = `${playfair.fontFamily}, ${mm}`;
export const FONT_HAND = `${caveat.fontFamily}, ${mm}`;
export const FONT_BEBAS = `${bebas.fontFamily}, ${mm}`;

const BY_KEY = { body: FONT_BODY, impact: FONT_IMPACT, fun: FONT_FUN, serif: FONT_SERIF, hand: FONT_HAND, bebas: FONT_BEBAS } as const;

export const fontFor = (key: Template["fonts"]["display"] | Template["fonts"]["headline"]) => BY_KEY[key];
