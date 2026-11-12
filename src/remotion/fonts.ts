import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMyanmar } from "@remotion/google-fonts/NotoSansMyanmar";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadLilita } from "@remotion/google-fonts/LilitaOne";

// Loaded once per page/render. Remotion waits for them before capturing frames.
const poppins = loadPoppins("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
const myanmar = loadMyanmar("normal", { weights: ["500", "700", "800"], subsets: ["myanmar"] });
const anton = loadAnton("normal", { weights: ["400"], subsets: ["latin"] });
const lilita = loadLilita("normal", { weights: ["400"], subsets: ["latin"] });

/** Body + captions: Poppins for Latin, Noto Sans Myanmar for Burmese. */
export const FONT_BODY = `${poppins.fontFamily}, ${myanmar.fontFamily}, sans-serif`;
/** Tall condensed capitals for "WORTH IT!" moments. */
export const FONT_IMPACT = `${anton.fontFamily}, ${myanmar.fontFamily}, sans-serif`;
/** Rounded playful display for the hook ("Hello BANGKOK"). */
export const FONT_FUN = `${lilita.fontFamily}, ${myanmar.fontFamily}, sans-serif`;
