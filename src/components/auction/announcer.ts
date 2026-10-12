"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const STORAGE_KEY = "wow-auction-sound";
const EVENT = "wow-auction-sound-change";

// The on/off choice lives in localStorage so it survives reloads; read it as an external store.
function readSound(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}
function writeSound(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang === "en-IN") ??
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

/**
 * Auctioneer voice + sound effects, all in the browser (Web Speech + Web Audio).
 * Browsers only allow sound after a tap, so it stays off until the viewer turns it on.
 */
export function useAnnouncer() {
  const enabled = useSyncExternalStore(subscribe, readSound, () => false);
  const audio = useRef<AudioContext | null>(null);
  const voice = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => (voice.current = pickVoice());
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  const ctx = () => {
    if (!audio.current) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audio.current = new AC();
    }
    if (audio.current.state === "suspended") void audio.current.resume();
    return audio.current;
  };

  const tone = useCallback((freq: number, ms: number, gain = 0.15, type: OscillatorType = "sine") => {
    const ac = ctx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + ms / 1000);
  }, []);

  const speak = useCallback(
    (text: string, opts: { interrupt?: boolean } = {}) => {
      if (!enabled || !("speechSynthesis" in window)) return;
      if (opts.interrupt) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voice.current) u.voice = voice.current;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    },
    [enabled],
  );

  const sfx = useCallback(
    (kind: "bid" | "tick" | "sold" | "unsold" | "next") => {
      if (!enabled) return;
      if (kind === "bid") tone(660, 120, 0.12, "triangle");
      if (kind === "tick") tone(990, 80, 0.1, "square");
      if (kind === "next") {
        tone(523, 140, 0.1);
        setTimeout(() => tone(784, 180, 0.1), 120);
      }
      if (kind === "unsold") tone(220, 400, 0.12, "sawtooth");
      if (kind === "sold") {
        // Two gavel knocks.
        tone(140, 160, 0.4, "square");
        setTimeout(() => tone(110, 220, 0.4, "square"), 180);
      }
    },
    [enabled, tone],
  );

  const toggle = useCallback(() => {
    const next = !readSound();
    writeSound(next);
    if (next) {
      ctx();
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance("Sound on");
        if (voice.current) u.voice = voice.current;
        window.speechSynthesis.speak(u);
      }
    } else {
      window.speechSynthesis?.cancel();
    }
  }, []);

  return { enabled, toggle, speak, sfx };
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const countWord = (n: number) => WORDS[n] ?? String(n);
