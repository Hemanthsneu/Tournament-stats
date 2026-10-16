"use client";

// Game-style sound effects, synthesised with Web Audio (no audio files): gunfire, a frying-pan
// clang, a grenade, a chicken-dinner jingle and so on. Crowd sounds are quiet, rate-limited and
// skipped while the auctioneer is talking, so they never drown out the auction itself.

export type Sfx = "awm" | "smg" | "pan" | "nade" | "dinner" | "money" | "clap" | "boom" | "skull" | "sold" | "unsold";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** A burst of filtered noise with a fast attack and exponential decay. */
function hiss(c: AudioContext, out: AudioNode, at: number, dur: number, gain: number, filter: BiquadFilterType, freq: number, q = 0.7, sweepTo?: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.05);
}

function tone(c: AudioContext, out: AudioNode, at: number, freq: number, dur: number, gain: number, type: OscillatorType = "sine", glideTo?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** One rifle shot: a sharp crack plus a low thump. */
function shot(c: AudioContext, out: AudioNode, at: number, loud = 1) {
  hiss(c, out, at, 0.09, 0.9 * loud, "highpass", 900);
  hiss(c, out, at, 0.16, 0.6 * loud, "lowpass", 1400, 0.7, 300);
  tone(c, out, at, 140, 0.12, 0.7 * loud, "sine", 45);
}

const PLAYERS: Record<Sfx, (c: AudioContext, out: AudioNode, t: number) => void> = {
  // AWM: one huge crack and a rolling echo across the map.
  awm: (c, out, t) => {
    shot(c, out, t, 1.3);
    hiss(c, out, t + 0.02, 0.9, 0.25, "lowpass", 700, 0.7, 120);
    shot(c, out, t + 0.32, 0.22);
  },
  // SMG spray: five quick rounds.
  smg: (c, out, t) => {
    for (let i = 0; i < 5; i++) shot(c, out, t + i * 0.075, 0.55 + Math.random() * 0.15);
  },
  // The legendary pan: inharmonic metal partials ringing out.
  pan: (c, out, t) => {
    hiss(c, out, t, 0.03, 0.8, "bandpass", 3000, 1.2);
    for (const [f, g] of [
      [523, 0.35],
      [1187, 0.22],
      [1832, 0.16],
      [2741, 0.1],
      [3613, 0.06],
    ])
      tone(c, out, t, f, 1.1, g, "sine", f * 0.985);
  },
  // Frag grenade: a deep boom with debris.
  nade: (c, out, t) => {
    tone(c, out, t, 90, 0.9, 0.9, "sine", 32);
    hiss(c, out, t, 1.3, 0.9, "lowpass", 1600, 0.6, 140);
    hiss(c, out, t + 0.15, 0.5, 0.15, "bandpass", 2400, 2);
  },
  boom: (c, out, t) => {
    tone(c, out, t, 70, 0.6, 0.8, "sine", 30);
    hiss(c, out, t, 0.7, 0.8, "lowpass", 2200, 0.6, 180);
  },
  // Winner winner: a bright little fanfare.
  dinner: (c, out, t) => {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, out, t + i * 0.09, f, 0.22, 0.28, "triangle"));
    tone(c, out, t + 0.36, 1319, 0.5, 0.22, "triangle");
  },
  // Cha-ching.
  money: (c, out, t) => {
    hiss(c, out, t, 0.05, 0.4, "highpass", 5000);
    tone(c, out, t + 0.02, 1760, 0.18, 0.25, "square");
    tone(c, out, t + 0.14, 2637, 0.45, 0.22, "sine");
    hiss(c, out, t + 0.14, 0.4, 0.12, "highpass", 6000);
  },
  clap: (c, out, t) => {
    let at = t;
    for (let i = 0; i < 5; i++) {
      hiss(c, out, at, 0.06, 0.7, "bandpass", 1500 + Math.random() * 500, 1.1);
      at += 0.07 + Math.random() * 0.06;
    }
  },
  skull: (c, out, t) => {
    tone(c, out, t, 220, 0.5, 0.35, "sawtooth", 70);
  },
  // SOLD: air horn plus a crowd swell.
  sold: (c, out, t) => {
    for (const f of [466, 587, 698]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      const vib = c.createOscillator();
      vib.frequency.value = 6;
      const vg = c.createGain();
      vg.gain.value = 4;
      vib.connect(vg).connect(o.frequency);
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      g.gain.setValueAtTime(0.16, t + 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(lp).connect(g).connect(out);
      o.start(t);
      vib.start(t);
      o.stop(t + 0.85);
      vib.stop(t + 0.85);
    }
    hiss(c, out, t + 0.1, 1.8, 0.35, "bandpass", 1100, 0.5);
  },
  unsold: (c, out, t) => {
    tone(c, out, t, 330, 0.35, 0.25, "triangle", 300);
    tone(c, out, t + 0.32, 262, 0.6, 0.25, "triangle", 196);
  },
};

let recent: number[] = [];

/**
 * Plays an effect. `crowd` sounds (from viewers' reactions) are quieter, limited to a few per
 * second and skipped while the auctioneer's voice is speaking.
 */
export function playSfx(kind: Sfx, { volume = 0.5, crowd = false }: { volume?: number; crowd?: boolean } = {}) {
  const c = audio();
  if (!c) return;
  if (crowd) {
    const now = performance.now();
    recent = recent.filter((t) => now - t < 1500);
    if (recent.length >= 3) return;
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) return;
    recent.push(now);
  }
  const master = c.createGain();
  master.gain.value = crowd ? Math.min(volume, 0.22) : volume;
  const comp = c.createDynamicsCompressor();
  master.connect(comp).connect(c.destination);
  PLAYERS[kind](c, master, c.currentTime + 0.01);
}

const CROWD_KEY = "wow-crowd-sounds";
/** Viewers can mute other people's reaction sounds while keeping the auctioneer. */
export const crowdSounds = {
  get(): boolean {
    try {
      return localStorage.getItem(CROWD_KEY) !== "off";
    } catch {
      return true;
    }
  },
  set(on: boolean) {
    try {
      localStorage.setItem(CROWD_KEY, on ? "on" : "off");
      window.dispatchEvent(new Event(CROWD_KEY));
    } catch {
      /* private mode */
    }
  },
  subscribe(cb: () => void) {
    window.addEventListener(CROWD_KEY, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CROWD_KEY, cb);
      window.removeEventListener("storage", cb);
    };
  },
};
