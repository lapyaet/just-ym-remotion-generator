// Generates original, royalty-free background tracks for the reels.
// Pure synthesis (no samples): drums, bass, chords and a plucked melody.
//
//   node scripts/make-music.mjs            -> public/music/*.wav (and .mp3 if ffmpeg is on PATH)
//
// Every track is a whole number of bars, so it loops seamlessly in Remotion.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SR = 44100;
const OUT = path.join(process.cwd(), "public", "music");

const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const midi = (name, octave) => 12 * (octave + 1) + NOTE[name];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Chord = root name + "maj"/"min". Returns MIDI notes (root position, octave 3). */
function chord(symbol) {
  const [, root, kind] = symbol.match(/^([A-G][#b]?)(m?)$/);
  const r = midi(root, 3);
  return kind ? [r, r + 3, r + 7] : [r, r + 4, r + 7];
}

// ---------- tiny DSP helpers ----------

let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

class OnePole {
  constructor(cutoff) { this.set(cutoff); this.z = 0; }
  set(cutoff) { this.a = Math.exp((-2 * Math.PI * cutoff) / SR); }
  lp(x) { return (this.z = x * (1 - this.a) + this.z * this.a); }
  hp(x) { return x - this.lp(x); }
}

function makeTrack(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), n };
}

function add(track, start, samples, gain = 1, pan = 0) {
  const i0 = Math.round(start * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
  for (let i = 0; i < samples.length; i++) {
    const j = (i0 + i) % track.n; // wrap tails to the start so the loop is seamless
    track.L[j] += samples[i] * gl;
    track.R[j] += samples[i] * gr;
  }
}

// ---------- instruments ----------

function kick(punch = 1) {
  const len = 0.45 * SR, out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 48 + 110 * Math.exp(-t * 28) * punch;
    phase += (2 * Math.PI * f) / SR;
    out[i] = Math.tanh(Math.sin(phase) * 2.2) * Math.exp(-t * 7);
  }
  return out;
}

function clap() {
  const len = 0.25 * SR, out = new Float32Array(len), hp = new OnePole(900), lp = new OnePole(6000);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const bursts = t < 0.03 ? 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 100) ** 2 : 1;
    out[i] = lp.lp(hp.hp(noise())) * Math.exp(-t * 18) * bursts;
  }
  return out;
}

function hat(open = false) {
  const len = (open ? 0.22 : 0.05) * SR, out = new Float32Array(len), hp = new OnePole(7000);
  for (let i = 0; i < len; i++) out[i] = hp.hp(noise()) * Math.exp((-i / SR) * (open ? 14 : 60));
  return out;
}

function shaker() {
  const len = 0.08 * SR, out = new Float32Array(len), hp = new OnePole(5000);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = hp.hp(noise()) * Math.sin(Math.min(1, t / 0.08) * Math.PI) * 0.6;
  }
  return out;
}

/** Plucky synth bass. */
function bass(note, dur) {
  const len = Math.round(dur * SR), out = new Float32Array(len), lp = new OnePole(400);
  const f = hz(note);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    lp.set(180 + 900 * Math.exp(-t * 14));
    const saw = 2 * ((t * f) % 1) - 1;
    const sub = Math.sin(2 * Math.PI * f * t);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 3) * (t > dur - 0.02 ? (dur - t) / 0.02 : 1);
    out[i] = (lp.lp(saw) * 0.7 + sub * 0.6) * env;
  }
  return out;
}

/** Warm detuned-saw chord pad. */
function pad(notes, dur, brightness = 1200) {
  const len = Math.round(dur * SR), out = new Float32Array(len), lp = new OnePole(brightness);
  const voices = notes.flatMap((m) => [hz(m + 12) * 0.997, hz(m + 12) * 1.003, hz(m + 24) * 1.001]);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const f of voices) s += 2 * ((t * f) % 1) - 1;
    const env = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.3);
    out[i] = lp.lp(s / voices.length) * env;
  }
  return out;
}

/** Bell / marimba-like pluck. */
function pluck(note, dur, tone = "bell") {
  const len = Math.round(Math.max(dur, 0.6) * SR), out = new Float32Array(len);
  const f = hz(note);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.002) * Math.exp(-t * (tone === "marimba" ? 9 : 5));
    const body = Math.sin(2 * Math.PI * f * t) + (tone === "marimba" ? 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 30) : 0.25 * Math.sin(2 * Math.PI * f * 2 * t) + 0.12 * Math.sin(2 * Math.PI * f * 3 * t));
    out[i] = body * env;
  }
  return out;
}

/** Bright supersaw stab for the festival track. */
function stab(notes, dur) {
  const len = Math.round(dur * SR), out = new Float32Array(len), lp = new OnePole(3000);
  const voices = notes.flatMap((m) => [-0.012, -0.004, 0.004, 0.012].map((d) => hz(m + 24) * (1 + d)));
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const f of voices) s += 2 * ((t * f + f * 0.37) % 1) - 1;
    out[i] = lp.lp(s / voices.length) * Math.exp(-t * 6) * Math.min(1, t / 0.003);
  }
  return out;
}

// ---------- arrangement ----------

function render({ bpm, bars, progression, groove, lead }) {
  const beat = 60 / bpm, bar = beat * 4, seconds = bars * bar;
  const track = makeTrack(seconds);
  const duck = new Float32Array(track.n).fill(1); // sidechain pumping from the kick
  const musical = makeTrack(seconds);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const notes = chord(progression[b % progression.length]);
    const root = notes[0] - 12;
    const section = b < 2 ? "intro" : b >= bars - 2 ? "outro" : "main";

    // Drums
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * (beat / 4);
      const on = (list) => list.includes(s);
      if (groove === "four" && on([0, 4, 8, 12]) && section !== "intro") {
        add(track, t, kick(), 0.5);
        markDuck(duck, t, beat);
      }
      if (groove === "tropical" && on([0, 6, 8, 14]) && section !== "intro") {
        add(track, t, kick(0.8), 0.48);
        markDuck(duck, t, beat * 0.8);
      }
      if (on([4, 12]) && section !== "intro") add(track, t, clap(), groove === "tropical" ? 0.18 : 0.26, 0.05);
      if (groove === "tropical" && on([3, 7, 11, 15]) && section !== "intro") add(track, t, clap(), 0.09, -0.2);
      if (s % 2 === 1) add(track, t, groove === "four" && s % 4 === 2 ? hat(true) : hat(), 0.08, 0.3);
      if (groove === "tropical" && s % 2 === 0) add(track, t, shaker(), 0.14, -0.35);
    }

    // Bass: eighth notes on the root, octave jump on the "and" of 4
    if (section !== "intro") {
      for (let e = 0; e < 8; e++) {
        const n = e === 7 ? root + 12 : root;
        add(musical, t0 + e * (beat / 2), bass(n, beat / 2 * 0.9), 0.42);
      }
    }

    // Chords
    add(musical, t0, pad(notes, bar, groove === "four" ? 1800 : 1100), groove === "tropical" ? 0.34 : 0.3);
    if (lead === "stab" && section === "main") {
      for (const s of [0, 3, 6, 10, 12]) add(musical, t0 + s * (beat / 4), stab(notes, beat / 4 * 1.5), 0.3, s % 2 ? 0.25 : -0.25);
    }

    // Melody: arpeggio pattern over chord tones (two octaves up)
    if (section !== "outro") {
      const pattern = lead === "marimba" ? [0, 2, 1, 2, 0, 2, 1, 3] : [0, 1, 2, 3, 2, 1, 2, 3];
      const tones = [...notes, notes[0] + 12].map((m) => m + 24);
      for (let k = 0; k < 8; k++) {
        if (lead === "stab" && k % 2 === 1) continue;
        const m = tones[pattern[(k + (b % 2) * 2) % pattern.length]];
        const p = pluck(m, beat / 2, lead === "marimba" ? "marimba" : "bell");
        add(musical, t0 + k * (beat / 2), p, 0.3, k % 2 ? 0.35 : -0.35);
        add(musical, t0 + k * (beat / 2) + beat * 0.75, p, 0.11, k % 2 ? -0.5 : 0.5); // dotted-eighth echo
      }
    }
  }

  // Mix: duck the music under the kick, soft-clip, normalise to -1 dBFS.
  for (let i = 0; i < track.n; i++) {
    track.L[i] += musical.L[i] * duck[i];
    track.R[i] += musical.R[i] * duck[i];
  }
  let peak = 0;
  for (let i = 0; i < track.n; i++) {
    track.L[i] = Math.tanh(track.L[i]);
    track.R[i] = Math.tanh(track.R[i]);
    peak = Math.max(peak, Math.abs(track.L[i]), Math.abs(track.R[i]));
  }
  // Background-bed level: aim for ~-16 dBFS RMS, never above -1 dBFS peak.
  let sum = 0;
  for (let i = 0; i < track.n; i++) sum += (track.L[i] ** 2 + track.R[i] ** 2) / 2;
  const rms = Math.sqrt(sum / track.n);
  const g = Math.min(0.89 / peak, 0.158 / rms);
  for (let i = 0; i < track.n; i++) { track.L[i] *= g; track.R[i] *= g; }
  return track;
}

function markDuck(duck, t, len) {
  const i0 = Math.round(t * SR), n = Math.round(len * SR);
  for (let i = 0; i < n; i++) {
    const j = (i0 + i) % duck.length;
    const x = i / n;
    duck[j] = Math.min(duck[j], 0.65 + 0.35 * Math.min(1, x * 3));
  }
}

function writeWav(file, { L, R, n }) {
  const buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

const TRACKS = [
  // Keep in sync with src/remotion/music.ts
  { file: "sunny-pop", bpm: 118, bars: 16, progression: ["D", "A", "Bm", "G"], groove: "four", lead: "bell" },
  { file: "tropical-chill", bpm: 98, bars: 16, progression: ["Dm", "Bb", "F", "C"], groove: "tropical", lead: "marimba" },
  { file: "festival-hype", bpm: 126, bars: 16, progression: ["Am", "F", "C", "G"], groove: "four", lead: "stab" },
];

fs.mkdirSync(OUT, { recursive: true });
const ffmpeg = process.env.FFMPEG || "ffmpeg";
for (const t of TRACKS) {
  seed = 1;
  const wav = path.join(OUT, `${t.file}.wav`);
  writeWav(wav, render(t));
  try {
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", path.join(OUT, `${t.file}.mp3`)]);
    fs.rmSync(wav);
    console.log(`public/music/${t.file}.mp3`);
  } catch {
    console.log(`public/music/${t.file}.wav (install ffmpeg or set FFMPEG=... to get an .mp3)`);
  }
}
