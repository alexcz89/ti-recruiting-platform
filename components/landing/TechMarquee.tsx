// components/landing/TechMarquee.tsx
'use client';

// Fila 1 — izquierda (12 logos): lenguajes + frontend
const ROW_1 = [
  { name: 'Python',     icon: '/logos/python-original.svg' },
  { name: 'JavaScript', icon: '/logos/javascript-original.svg' },
  { name: 'TypeScript', icon: '/logos/typescript-original.svg' },
  { name: 'Go',         icon: '/logos/go-original.svg' },
  { name: 'Rust',       icon: '/logos/rust-original.svg' },
  { name: 'Java',       icon: '/logos/java-original.svg' },
  { name: 'Kotlin',     icon: '/logos/kotlin-original.svg' },
  { name: 'Swift',      icon: '/logos/swift-original.svg' },
  { name: 'React',      icon: '/logos/react-original.svg' },
  { name: 'Vue',        icon: '/logos/vuejs-original.svg' },
  { name: 'Node.js',    icon: '/logos/nodejs-plain.svg' },
  { name: 'Next.js',    icon: '/logos/nextjs-original.svg' },
];

// Fila 2 — derecha (12 logos): backend + infra + otros
const ROW_2 = [
  { name: 'C++',        icon: '/logos/cplusplus-original.svg' },
  { name: 'C#',         icon: '/logos/csharp-original.svg' },
  { name: 'PHP',        icon: '/logos/php-original.svg' },
  { name: 'Ruby',       icon: '/logos/ruby-original.svg' },
  { name: 'Dart',       icon: '/logos/dart-original.svg' },
  { name: 'Scala',      icon: '/logos/scala-original.svg' },
  { name: 'MySQL',      icon: '/logos/mysql-original.svg' },
  { name: 'PostgreSQL', icon: '/logos/postgresql-original.svg' },
  { name: 'MongoDB',    icon: '/logos/mongodb-original.svg' },
  { name: 'Docker',     icon: '/logos/docker-original.svg' },
  { name: 'Git',        icon: '/logos/git-original.svg' },
  { name: 'GraphQL',    icon: '/logos/graphql-plain.svg' },
];

const MASK =
  'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)';

// Cada card: 64px ancho + 12px margin-right = 76px por item
// El offset es el ancho exacto de UN set (sin depender de porcentajes)
const CARD_STEP = 76; // px
const OFFSET_1  = ROW_1.length * CARD_STEP; // 912px
const OFFSET_2  = ROW_2.length * CARD_STEP; // 912px

function LogoCard({ name, icon }: { name: string; icon: string }) {
  return (
    <div
      style={{ width: 64, height: 72, flexShrink: 0, marginRight: 12 }}
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt={name}
        width={32}
        height={32}
        style={{ width: 32, height: 32, objectFit: 'contain' }}
        loading="lazy"
      />
      <span
        style={{ width: 56, fontSize: 9 }}
        className="block truncate text-center font-medium leading-none text-zinc-500 dark:text-zinc-400"
      >
        {name}
      </span>
    </div>
  );
}

export default function TechMarquee() {
  return (
    <section className="overflow-hidden bg-zinc-50/60 py-16 dark:bg-zinc-900/40 md:py-24">
      {/* ── Header ── */}
      <div className="mb-12 px-4 text-center">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-semibold text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300">
          Evaluaciones técnicas
        </span>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Evalúa cualquier tecnología
        </h2>
        <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
          +40 lenguajes y frameworks disponibles para tus assessments
        </p>
      </div>

      {/* ── Fila 1 — izquierda ── */}
      <div
        className="marquee-wrapper relative mb-4 overflow-hidden"
        style={{ maskImage: MASK, WebkitMaskImage: MASK }}
      >
        <div
          className="marquee-track flex py-2"
          style={{ '--marquee-offset': `${OFFSET_1}px` } as React.CSSProperties}
        >
          {[...ROW_1, ...ROW_1].map((logo, i) => (
            <LogoCard key={`r1-${i}`} {...logo} />
          ))}
        </div>
      </div>

      {/* ── Fila 2 — derecha ── */}
      <div
        className="marquee-wrapper relative overflow-hidden"
        style={{ maskImage: MASK, WebkitMaskImage: MASK }}
      >
        <div
          className="marquee-track-reverse flex py-2"
          style={{ '--marquee-offset': `${OFFSET_2}px` } as React.CSSProperties}
        >
          {[...ROW_2, ...ROW_2].map((logo, i) => (
            <LogoCard key={`r2-${i}`} {...logo} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        También: Bash, R, Elixir, Haskell, Lua, Redis, Tailwind y más.
      </p>
    </section>
  );
}
