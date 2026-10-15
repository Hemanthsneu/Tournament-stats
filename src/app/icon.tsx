import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Scope reticle on broadcast navy. */
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0c1a3a", borderRadius: 14 }}>
        <svg width="54" height="54" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" fill="none" stroke="#ffffff" strokeWidth="2.4" />
          <path d="M12 1.6v5M12 17.4v5M1.6 12h5M17.4 12h5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="12" r="2.6" fill="#e4002b" />
        </svg>
      </div>
    ),
    size,
  );
}
