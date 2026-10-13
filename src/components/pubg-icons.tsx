// Original battle-royale themed icon set (24×24, currentColor). Inspired by the genre's loot and
// lingo, not copied from any game's artwork.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} {...props}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Kills */
export const CrosshairIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 1.8v5M12 17.2v5M1.8 12h5M17.2 12h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.8" />
  </Svg>
);

/** Wins: winner winner, chicken dinner */
export const ChickenIcon = (p: IconProps) => (
  <Svg {...p}>
    <g transform="rotate(40 12 12)">
      <ellipse cx="12" cy="7.6" rx="5.2" ry="6" />
      <rect x="10.7" y="12.4" width="2.6" height="6" rx="1.1" />
      <circle cx="10.4" cy="19.4" r="1.75" />
      <circle cx="13.6" cy="19.4" r="1.75" />
    </g>
  </Svg>
);

/** Losses */
export const SkullIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      fillRule="evenodd"
      d="M12 2.5a8.2 8.2 0 0 0-8.2 8.2c0 2.6 1.2 4.5 3 5.6V19a1.3 1.3 0 0 0 1.3 1.3H9.2v-2.1h1.7v2.1h2.2v-2.1h1.7v2.1h1.1a1.3 1.3 0 0 0 1.3-1.3v-2.7c1.8-1.1 3-3 3-5.6A8.2 8.2 0 0 0 12 2.5zM8.6 9.2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6.8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13.6l-1.1 1.9h2.2z"
    />
  </Svg>
);

/** Matches played: the drop */
export const ParachuteIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 10.2C2.5 5.6 6.8 2.2 12 2.2s9.5 3.4 9.5 8z" />
    <path d="M3.2 10.2 10.8 17M20.8 10.2 13.2 17M8.4 10.2l2.8 6.8M15.6 10.2l-2.8 6.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
    <rect x="10" y="16.6" width="4" height="5" rx="1.4" />
  </Svg>
);

/** Rounds won */
export const HelmetIcon = (p: IconProps) => (
  <Svg {...p}>
    <path fillRule="evenodd" d="M3.6 15C3.6 9.7 7.4 5.4 12 5.4s8.4 4.3 8.4 9.6v1.6H3.6zM6.2 12.4h11.6v1.8H6.2z" />
    <path d="M2 16.8h20v1.5a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 18.3z" />
  </Svg>
);

/** Rounds lost */
export const HelmetCrackedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path fillRule="evenodd" d="M3.6 15C3.6 9.7 7.4 5.4 12 5.4s8.4 4.3 8.4 9.6v1.6H3.6zM11.4 6.6l1.6 3-1.8 1.6 1.4 2.4-.8.3-1.7-2.7 1.8-1.6-1.5-2.8z" />
    <path d="M2 16.8h20v1.5a1.6 1.6 0 0 1-1.6 1.6H3.6A1.6 1.6 0 0 1 2 18.3z" opacity=".55" />
  </Svg>
);

/** Net Round Rate */
export const BulletIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 1.6c2.3 2.2 3.4 4.9 3.4 7.6v7.6H8.6V9.2c0-2.7 1.1-5.4 3.4-7.6z" />
    <path d="M8 18.2h8v2.9a1.3 1.3 0 0 1-1.3 1.3H9.3A1.3 1.3 0 0 1 8 21.1z" opacity=".55" />
  </Svg>
);

/** Round win % */
export const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <path fillRule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3.2a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6z" />
    <circle cx="12" cy="12" r="3.4" />
  </Svg>
);

/** Kills conceded: hit marker */
export const HitMarkerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 4.5 9.2 9.2M19.5 4.5l-4.7 4.7M4.5 19.5l4.7-4.7M19.5 19.5l-4.7-4.7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
  </Svg>
);

/** Net Kill Rate: scope */
export const ScopeIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 4.6v14.8M4.6 12h14.8" stroke="currentColor" strokeWidth="1.3" />
    <path d="M9.5 12.9v-1.8M14.5 12.9v-1.8M11.1 9.5h1.8M11.1 14.5h1.8" stroke="currentColor" strokeWidth="1.3" />
  </Svg>
);

/** Revives */
export const MedkitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path
      fillRule="evenodd"
      d="M9 3.5h6A1.2 1.2 0 0 1 16.2 4.7V7h2.9A2 2 0 0 1 21 9v9.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.8V4.7A1.2 1.2 0 0 1 9 3.5zm.6 1.8V7h4.8V5.3zM10.8 9.8h2.4v2.6h2.6v2.4h-2.6v2.6h-2.4v-2.6H8.2v-2.4h2.6z"
    />
  </Svg>
);

/** Form / streak: energy drink */
export const EnergyIcon = (p: IconProps) => (
  <Svg {...p}>
    <path fillRule="evenodd" d="M8.2 2.5h7.6l.7 2.4v15A1.6 1.6 0 0 1 14.9 21.5H9.1a1.6 1.6 0 0 1-1.6-1.6v-15zM13 7.6l-3.2 5.2h2.1l-1 4.2 3.4-5.6h-2.2z" />
  </Svg>
);

/** Points: airdrop crate */
export const CrateIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 8.3C5 5 8.1 2.5 12 2.5S19 5 19 8.3z" />
    <path d="M5.6 8.3 9.6 13M18.4 8.3 14.4 13M12 8.3V13" stroke="currentColor" strokeWidth="1.3" fill="none" />
    <path fillRule="evenodd" d="M6.8 13h10.4a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1V14a1 1 0 0 1 1-1zm1.3 3.7v1.3h7.8v-1.3z" />
  </Svg>
);

/** MVP: the legendary pan */
export const PanIcon = (p: IconProps) => (
  <Svg {...p}>
    <g transform="rotate(-28 12 12)">
      <path fillRule="evenodd" d="M8.4 5.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6zm0 2.1a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4z" />
      <circle cx="8.4" cy="12" r="3.3" opacity=".45" />
      <rect x="14.6" y="10.7" width="9" height="2.6" rx="1.3" />
    </g>
  </Svg>
);
