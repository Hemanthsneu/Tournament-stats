import { ChickenIcon, CrateIcon, CrosshairIcon, PanIcon } from "@/components/pubg-icons";
import { display, label, OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const alt = "WOW League: BGMI WOW mode points table, schedule, player stats and live auction";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

const TILES = [
  { Icon: CrateIcon, text: "Points table", color: "#e4002b" },
  { Icon: CrosshairIcon, text: "Kills & stats", color: "#ff9f43" },
  { Icon: PanIcon, text: "MVP race", color: "#f2b705" },
  { Icon: ChickenIcon, text: "Live auction", color: "#34d399" },
];

export default async function Image() {
  return ogImage({
    eyebrow: "BGMI · WOW mode league",
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <div style={{ display: "flex", flexDirection: "column", ...display(104) }}>
          <span>Every round.</span>
          <span>Every kill.</span>
          <span style={{ color: "#ff2d4b" }}>Every chicken dinner.</span>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {TILES.map(({ Icon, text, color }) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <Icon width={34} height={34} style={{ color }} />
              <span style={label(24, { letterSpacing: 1 })}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  });
}
