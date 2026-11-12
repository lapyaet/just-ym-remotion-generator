// Generates original sound effects for the reels (pure synthesis, no samples).
//
//   node scripts/make-sfx.mjs   -> public/sfx/*.mp3 (needs ffmpeg on PATH, or FFMPEG=...)
//
// Keep the names in sync with SFX in src/remotion/music.ts.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SR = 44100;
const OUT = path.join(process.cwd(), "public", "sfx");

let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

class Filter {
  // State-variable filter: lowpass / bandpass / highpass in one.
  constructor() { this.low = 0; this.band = 0; }
  run(x, cutoff, q = 0.7) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SR / 6)) / SR);
    this.low += f * this.band;
    const high = x - this.low - q * this.band;
    this.band += f * high;
    return { low: this.low, band: this.band, high };
  }
}

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * SR));
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);

/** Airy whoosh: band-passed noise sweeping up then down. */
function whoosh(len = 0.55) {
  const out = buffer(len), f = new Filter();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, p = t / len;
    const cutoff = 400 + 5200 * Math.sin(Math.PI * p) ** 1.5;
    const amp = Math.sin(Math.PI * p) ** 2;
    out[i] = f.run(noise(), cutoff, 0.35).band * amp * 2.2;
  }
  return out;
}

/** Bubbly pop for cards and stickers. */
function pop() {
  const out = buffer(0.18);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (380 + 900 * Math.exp(-t * 40))) / SR;
    out[i] = Math.sin(ph) * env(t, 0.002, 0.045);
  }
  return out;
}

/** Deep cinematic impact / boom. */
function impact() {
  const out = buffer(1.4), f = new Filter();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (38 + 70 * Math.exp(-t * 9))) / SR;
    const body = Math.tanh(Math.sin(ph) * 2.5) * env(t, 0.003, 0.45);
    const crack = f.run(noise(), 2200, 0.5).band * env(t, 0.001, 0.05) * 0.9;
    out[i] = body * 0.9 + crack;
  }
  return out;
}

/** Bright "ding" for success / payment. */
function ding() {
  const out = buffer(1.2);
  const partials = [[1318.5, 1], [2637, 0.35], [3951, 0.18], [1975.5, 0.3]];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (const [hz, a] of partials) s += Math.sin(2 * Math.PI * hz * t) * a * Math.exp(-t * (2.5 + hz / 2000));
    out[i] = s * Math.min(1, t / 0.002) * 0.6;
  }
  return out;
}

/** Rising tension sweep leading into a big moment. */
function riser(len = 1.6) {
  const out = buffer(len), f = new Filter();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, p = t / len;
    ph += (2 * Math.PI * (180 + 1400 * p * p)) / SR;
    const tone = Math.sin(ph) * 0.25 + Math.sin(ph * 1.5) * 0.12;
    const air = f.run(noise(), 600 + 7000 * p, 0.4).band * 0.8;
    out[i] = (tone + air) * p ** 2 * (p > 0.97 ? (1 - p) / 0.03 : 1);
  }
  return out;
}

/** Short UI tap / click. */
function click() {
  const out = buffer(0.06), f = new Filter();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (f.run(noise(), 3500, 0.3).band * 1.4 + Math.sin(2 * Math.PI * 1800 * t) * 0.4) * env(t, 0.0005, 0.012);
  }
  return out;
}

/** Sparkly shimmer for glitter / neon moments. */
function sparkle() {
  const out = buffer(0.9);
  const notes = [2093, 2637, 3136, 4186, 3520];
  notes.forEach((hz, k) => {
    const start = Math.floor(k * 0.07 * SR);
    for (let i = 0; i + start < out.length; i++) {
      const t = i / SR;
      out[i + start] += Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 9) * 0.35 * Math.min(1, t / 0.001);
    }
  });
  return out;
}

/** Paper slide / swipe for the journal template. */
function swipe() {
  const out = buffer(0.35), f = new Filter();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, p = t / 0.35;
    out[i] = f.run(noise(), 1500 + 3500 * p, 0.6).high * Math.sin(Math.PI * p) ** 3 * 0.9;
  }
  return out;
}

/** Camera-shutter style stamp thump for the journal stamp. */
function stamp() {
  const out = buffer(0.4), f = new Filter();
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (90 + 160 * Math.exp(-t * 30))) / SR;
    out[i] = Math.sin(ph) * env(t, 0.001, 0.08) + f.run(noise(), 1200, 0.6).band * env(t, 0.001, 0.03);
  }
  return out;
}

function normalize(x, peak = 0.85) {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < x.length; i++) x[i] = (x[i] / (m || 1)) * peak;
  return x;
}

function writeWav(file, mono) {
  const n = mono.length, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mono[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const SFX = { whoosh, pop, impact, ding, riser, click, sparkle, swipe, stamp };
fs.mkdirSync(OUT, { recursive: true });
const ffmpeg = process.env.FFMPEG || "ffmpeg";
for (const [name, make] of Object.entries(SFX)) {
  seed = 7;
  const wav = path.join(OUT, `${name}.wav`);
  writeWav(wav, normalize(make()));
  try {
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "160k", path.join(OUT, `${name}.mp3`)]);
    fs.rmSync(wav);
    console.log(`public/sfx/${name}.mp3`);
  } catch {
    console.log(`public/sfx/${name}.wav (install ffmpeg or set FFMPEG=... for .mp3)`);
  }
}
