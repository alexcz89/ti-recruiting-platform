// components/landing/TechMarquee.tsx
'use client';

const ROW_1 = [
  { name: 'Python',     icon: '/logos/python-original.svg' },
  { name: 'JavaScript', icon: '/logos/javascript-original.svg' },
  { name: 'TypeScript', icon: '/logos/typescript-original.svg' },
  { name: 'Go',         icon: '/logos/go-original.svg' },
  { name: 'Rust',       icon: '/logos/rust-original.svg' },
  { name: 'Java',       icon: '/logos/java-original.svg' },
  { name: 'Kotlin',     icon: '/logos/kotlin-original.svg' },
  { name: 'Swift',      icon: '/logos/swift-original.svg' },
];

const ROW_2 = [
  { name: 'C++',    icon: '/logos/cplusplus-original.svg' },
  { name: 'C#',     icon: '/logos/csharp-original.svg' },
  { name: 'PHP',    icon: '/logos/php-original.svg' },
  { name: 'Ruby',   icon: '/logos/ruby-original.svg' },
  { name: 'Dart',   icon: '/logos/dart-original.svg' },
  { name: 'Scala',  icon: '/logos/scala-original.svg' },
  { name: 'MySQL',  icon: '/logos/mysql-original.svg' },
  { name: 'Go',     icon: '/logos/go-original.svg' },
];

const MASK =
  'linear-gradient(to right, transparent, black 10%, black 90%, transparent)';

function LogoCard({ name, icon }: { name: string; icon: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 shadow-sm dark:border-zinc-700/60 dark:bg-zinc-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon}
        alt={name}
        width={28}
        height={28}
        className="object-contain"
        loading="lazy"
      />
      <span className="w-full truncate text-center text-[9px] font-medium leading-none text-zinc-500 dark:text-zinc-400">
        {name}
      </span>
    </div>
  );
}

export default function TechMarquee() {
  return (
    <section className="overflow-hidden py-16 md:py-24">
      {/* ── Header ── */}
      <div className="mb-10 px-4 text-center">
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
        style={{
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        <div className="marquee-track flex gap-4 py-2">
          {[...ROW_1, ...ROW_1].map((logo, i) => (
            <LogoCard key={`r1-${i}`} {...logo} />
          ))}
        </div>
      </div>

      {/* ── Fila 2 — derecha ── */}
      <div
        className="marquee-wrapper relative overflow-hidden"
        style={{
          maskImage: MASK,
          WebkitMaskImage: MASK,
        }}
      >
        <div className="marquee-track-reverse flex gap-4 py-2">
          {[...ROW_2, ...ROW_2].map((logo, i) => (
            <LogoCard key={`r2-${i}`} {...logo} />
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
        Y muchos más — Bash, R, Haskell, Elixir, Perl...
      </p>
    </section>
  );
}
