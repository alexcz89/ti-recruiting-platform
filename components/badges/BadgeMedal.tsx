// components/badges/BadgeMedal.tsx
// Medallón hexagonal de badge — el objeto coleccionable del sistema de
// certificaciones. Server-safe (SVG puro, sin estado).
//
// Jerarquía de niveles por color de banda/anillo:
//   1 Básico     → teal (marca)
//   2 Intermedio → dorado
//   3 Avanzado   → platino (casi negro)
//
// El medallón es un "objeto físico": interior blanco fijo en ambos temas,
// como una medalla real sobre cualquier fondo.
import { badgeLevelLabel } from "@/lib/badges";

const TIERS: Record<number, { ring: string; band: string; bandText: string }> = {
  1: { ring: "#0d9488", band: "#0d9488", bandText: "#ffffff" },
  2: { ring: "#b45309", band: "#f59e0b", bandText: "#ffffff" },
  3: { ring: "#3f3f46", band: "#18181b", bandText: "#ffffff" },
};

// Hexágono exterior e interior (inset 10%) sobre viewBox 200x220
const OUTER = "M100 6 L186 57 L186 163 L100 214 L14 163 L14 57 Z";
const INNER =
  "M100 16.4 L177.4 62.3 L177.4 157.7 L100 203.6 L22.6 157.7 L22.6 62.3 Z";

export type BadgeMedalState = "earned" | "available" | "locked";

export function BadgeMedal({
  skill,
  level,
  state = "earned",
  size = 140,
  logoSrc = null,
}: {
  skill: string;
  level: number;
  state?: BadgeMedalState;
  size?: number;
  /** Logo oficial de la tecnología; sin logo, el nombre va en texto grande */
  logoSrc?: string | null;
}) {
  const tier = TIERS[level] ?? TIERS[1];
  const levelLabel = badgeLevelLabel(level).toUpperCase();
  const skillSize =
    skill.length <= 6 ? 27 : skill.length <= 10 ? 21 : skill.length <= 13 ? 17 : 14;
  const clipId = `medal-clip-${skill.replace(/[^a-zA-Z0-9]/g, "")}-${level}`;

  const stateClass =
    state === "earned"
      ? "drop-shadow-md"
      : state === "available"
        ? "opacity-70 saturate-[0.15]"
        : "opacity-35 saturate-0";

  return (
    <svg
      width={size}
      height={(size * 220) / 200}
      viewBox="0 0 200 220"
      role="img"
      aria-label={`Badge ${skill} nivel ${badgeLevelLabel(level)}${state === "earned" ? " obtenido" : state === "locked" ? " bloqueado" : ""}`}
      className={stateClass}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={INNER} />
        </clipPath>
      </defs>

      {/* Anillo exterior */}
      <path d={OUTER} fill={tier.ring} />
      {/* Cuerpo */}
      <path d={INNER} fill="#ffffff" />

      <g clipPath={`url(#${clipId})`}>
        {/* Banda de nivel */}
        <rect x="0" y="148" width="200" height="36" fill={tier.band} />

        {/* Marca */}
        <text
          x="100"
          y={logoSrc ? 46 : 55}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          letterSpacing="3.5"
          fill="#71717a"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          TASKIO
        </text>

        {logoSrc ? (
          <>
            {/* Logo oficial de la tecnología */}
            <image href={logoSrc} x="63" y="56" width="74" height="74" />
            <text
              x="100"
              y="142"
              textAnchor="middle"
              fontSize="13"
              fontWeight="800"
              fill="#18181b"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {skill}
            </text>
          </>
        ) : (
          <text
            x="100"
            y="112"
            textAnchor="middle"
            fontSize={skillSize}
            fontWeight="800"
            fill="#18181b"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {skill}
          </text>
        )}

        {/* Check de obtenido */}
        {state === "earned" && (
          <g transform={logoSrc ? "translate(151, 63)" : "translate(100, 132)"}>
            <circle r="9" fill={tier.band} />
            <path
              d="M-4 0 L-1.2 3 L4.5 -3.5"
              stroke="#ffffff"
              strokeWidth="2.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}

        {/* Nivel */}
        <text
          x="100"
          y="171"
          textAnchor="middle"
          fontSize="15"
          fontWeight="800"
          letterSpacing="2"
          fill={tier.bandText}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          {levelLabel}
        </text>
      </g>

      {/* Candado para niveles bloqueados */}
      {state === "locked" && (
        <g transform="translate(100, 110)">
          <circle r="26" fill="#18181b" opacity="0.75" />
          <rect x="-9" y="-4" width="18" height="14" rx="2.5" fill="#ffffff" />
          <path
            d="M-5.5 -4 V-9 a5.5 5.5 0 0 1 11 0 V-4"
            stroke="#ffffff"
            strokeWidth="3"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}
