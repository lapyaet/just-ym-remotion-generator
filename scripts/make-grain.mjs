// Generates public/fx/grain.png: a grey film-grain texture used as an overlay
// (mix-blend-mode: overlay) by the "Modern Pulse" design. Pure Node, no deps.
//   node scripts/make-grain.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 432;
const H = 768;

let s = 1234567;
const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
// Roughly gaussian noise around mid grey.
const px = () => Math.max(0, Math.min(255, Math.round(128 + (rnd() + rnd() + rnd() - 1.5) * 150)));

const raw = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W + 1)] = 0; // filter: none
  for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = px();
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 0; // greyscale
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(new URL("../public/fx/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/fx/grain.png", import.meta.url), png);
console.log(`public/fx/grain.png ${W}x${H} (${(png.length / 1024).toFixed(0)} KB)`);
