import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: scope reticle with the red slash. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0c1a3a", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -20, top: -10, width: 34, height: 220, background: "#e4002b", transform: "skewX(-12deg)", display: "flex" }} />
        <svg width="132" height="132" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" fill="none" stroke="#ffffff" strokeWidth="2" />
          <path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.2" fill="#e4002b" />
        </svg>
      </div>
    ),
    size,
  );
}
