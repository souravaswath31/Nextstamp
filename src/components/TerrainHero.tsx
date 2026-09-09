// Original, hand-built SVG illustrations for state guide hero banners.
// Deliberately not photography: no licensing risk, and gives every
// terrain type ("mountain", "desert", "coast", "plains", "forest") a
// consistent, on-brand illustrated identity instead of hunting down
// per-state licensed photos.

type Props = {
  terrain: string;
  className?: string;
};

export default function TerrainHero({ terrain, className }: Props) {
  const commonProps = {
    viewBox: "0 0 800 280",
    className: className ?? "h-48 w-full sm:h-64",
    preserveAspectRatio: "xMidYMid slice",
  };

  if (terrain === "desert") {
    return (
      <svg {...commonProps}>
        <defs>
          <linearGradient id="skyDesert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFEBD6" />
            <stop offset="100%" stopColor="#FFD9C7" />
          </linearGradient>
        </defs>
        <rect width="800" height="280" fill="url(#skyDesert)" />
        <circle cx="640" cy="70" r="46" fill="#FF5A5F" opacity="0.85" />
        <path d="M0,220 Q120,150 260,210 T520,190 T800,215 V280 H0 Z" fill="#FB7A3C" opacity="0.55" />
        <path d="M0,250 Q160,200 340,245 T700,230 L800,250 V280 H0 Z" fill="#E8DFC9" />
        <path d="M120,250 L150,190 L180,250 Z" fill="#D6336C" opacity="0.5" />
        <path d="M540,250 L580,175 L620,250 Z" fill="#D6336C" opacity="0.4" />
      </svg>
    );
  }

  if (terrain === "coast") {
    return (
      <svg {...commonProps}>
        <defs>
          <linearGradient id="skyCoast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DFF3F8" />
            <stop offset="100%" stopColor="#BEE9F2" />
          </linearGradient>
        </defs>
        <rect width="800" height="280" fill="url(#skyCoast)" />
        <circle cx="600" cy="60" r="34" fill="#F5A623" opacity="0.9" />
        <path d="M0,180 Q200,150 400,180 T800,175 V280 H0 Z" fill="#06B6D4" opacity="0.5" />
        <path d="M0,215 Q220,190 440,215 T800,205 V280 H0 Z" fill="#06B6D4" opacity="0.75" />
        <path d="M0,250 Q240,235 480,250 T800,245 V280 H0 Z" fill="#F5EDDD" />
      </svg>
    );
  }

  if (terrain === "plains") {
    return (
      <svg {...commonProps}>
        <defs>
          <linearGradient id="skyPlains" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDF3D9" />
            <stop offset="100%" stopColor="#FBE7B8" />
          </linearGradient>
        </defs>
        <rect width="800" height="280" fill="url(#skyPlains)" />
        <circle cx="620" cy="80" r="40" fill="#F5A623" opacity="0.85" />
        <path d="M0,240 Q200,220 400,238 T800,232 V280 H0 Z" fill="#F5A623" opacity="0.35" />
        <path d="M0,260 Q220,245 440,258 T800,255 V280 H0 Z" fill="#2FA84F" opacity="0.4" />
      </svg>
    );
  }

  if (terrain === "forest") {
    return (
      <svg {...commonProps}>
        <defs>
          <linearGradient id="skyForest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E4F2E8" />
            <stop offset="100%" stopColor="#CDEBD6" />
          </linearGradient>
        </defs>
        <rect width="800" height="280" fill="url(#skyForest)" />
        <circle cx="660" cy="65" r="36" fill="#F5A623" opacity="0.8" />
        <path d="M0,230 Q200,170 400,225 T800,210 V280 H0 Z" fill="#2FA84F" opacity="0.45" />
        <path d="M0,255 Q220,210 440,250 T800,240 V280 H0 Z" fill="#2FA84F" opacity="0.75" />
        {[80, 180, 300, 420, 540, 660].map((x, i) => (
          <path key={i} d={`M${x},260 L${x + 18},200 L${x + 36},260 Z`} fill="#22283B" opacity="0.15" />
        ))}
      </svg>
    );
  }

  // default: mountain
  return (
    <svg {...commonProps}>
      <defs>
        <linearGradient id="skyMountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE3D6" />
          <stop offset="100%" stopColor="#FFD0DA" />
        </linearGradient>
      </defs>
      <rect width="800" height="280" fill="url(#skyMountain)" />
      <circle cx="600" cy="70" r="42" fill="#FF5A5F" opacity="0.8" />
      <path d="M0,220 L120,90 L220,180 L320,60 L430,190 L540,100 L640,200 L720,120 L800,210 V280 H0 Z" fill="#3B82F6" opacity="0.35" />
      <path d="M0,250 L100,150 L200,220 L300,110 L420,230 L520,140 L630,235 L720,160 L800,240 V280 H0 Z" fill="#2FA84F" opacity="0.55" />
      <path d="M320,60 L300,110 L340,110 Z" fill="#fff" opacity="0.7" />
      <path d="M540,100 L520,140 L560,140 Z" fill="#fff" opacity="0.7" />
    </svg>
  );
}
