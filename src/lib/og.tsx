// Shared look for link-preview images (WhatsApp, Discord, X…): 1200×630, broadcast navy, PUBG motifs.
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CrosshairIcon } from "@/components/pubg-icons";
import { onColor } from "@/lib/team-colors";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const NAVY = "#0c1a3a";
const NAVY_2 = "#13254f";
export const HOT = "#e4002b";
export const GOLD = "#f2b705";

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" | "italic" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf")).then((data) => ({ name: "Barlow", data, weight: 800 as const, style: "italic" as const })),
    readFile(join(process.cwd(), "src/assets/fonts/BarlowCondensed-SemiBold.ttf")).then((data) => ({ name: "Barlow", data, weight: 600 as const, style: "normal" as const })),
  ]);
  return fonts;
}

/** Big italic display text. */
export const display = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: "Barlow",
  fontWeight: 800,
  fontStyle: "italic",
  fontSize: size,
  lineHeight: 0.92,
  textTransform: "uppercase",
  letterSpacing: -1,
  ...extra,
});

/** Small caps-style labels. */
export const label = (size: number, extra: React.CSSProperties = {}): React.CSSProperties => ({
  fontFamily: "Barlow",
  fontWeight: 600,
  fontSize: size,
  letterSpacing: 2,
  textTransform: "uppercase",
  ...extra,
});

export function TeamTile({ tag, color, size = 64 }: { tag: string; color: string; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size * 1.35, height: size, borderRadius: size / 6, background: color, color: onColor(color), ...display(size * 0.55, { letterSpacing: 0 }) }}>
      {tag}
    </div>
  );
}

/** Renders a share card: navy field, scope rings, a red slash, the eyebrow, your content and the wordmark. */
export async function ogImage({ eyebrow, accent = HOT, children }: { eyebrow: string; accent?: string; children: React.ReactNode }) {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: NAVY, color: "#fff", position: "relative", overflow: "hidden", fontFamily: "Barlow" }}>
        {/* glow + scope rings */}
        <div style={{ position: "absolute", top: 5, right: -10, width: 620, height: 620, borderRadius: 620, background: NAVY_2, opacity: 0.55, display: "flex" }} />
        {[560, 420, 280].map((d) => (
          <div key={d} style={{ position: "absolute", top: 315 - d / 2, right: 170 - d / 2 + 140, width: d, height: d, borderRadius: d, border: "2px solid rgba(255,255,255,0.07)", display: "flex" }} />
        ))}
        <div style={{ position: "absolute", top: 315, right: 30, width: 560, height: 2, background: "rgba(255,255,255,0.06)", display: "flex" }} />
        <div style={{ position: "absolute", top: 35, right: 309, width: 2, height: 560, background: "rgba(255,255,255,0.06)", display: "flex" }} />
        <CrosshairIcon width={170} height={170} style={{ position: "absolute", right: 225, top: 230, color: "rgba(255,255,255,0.06)" }} />
        {/* red slash */}
        <div style={{ position: "absolute", left: -60, top: 0, width: 40, height: 700, background: accent, transform: "skewX(-12deg)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 72px 48px 84px", width: "100%", height: "100%", position: "relative" }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", background: accent, color: accent === GOLD ? NAVY : "#fff", padding: "6px 14px", borderRadius: 6, ...label(24) }}>{eyebrow}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center" }}>{children}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={display(44, { letterSpacing: -1 })}>WOW</span>
            <div style={{ display: "flex", width: 7, height: 30, background: HOT, transform: "skewX(-12deg)" }} />
            <span style={label(26, { letterSpacing: 6 })}>League</span>
            <span style={label(22, { marginLeft: 22, color: "rgba(255,255,255,0.55)" })}>BGMI · WOW mode · wow-league.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
