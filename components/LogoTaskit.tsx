// components/LogoTaskit.tsx
"use client";

import Image from "next/image";
import clsx from "clsx";

type LogoTaskitProps = {
  className?: string;
};

export default function LogoTaskit({ className }: LogoTaskitProps) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {/* Contenedor fijo para evitar que salte el layout */}
      <div
        className={clsx(
          "relative h-7 w-[110px] md:h-8 md:w-[130px]",
          className
        )}
      >
        {/* Logo para fondo claro */}
        <Image
          src="/logos/logo-taskit-light.svg"
          alt="TaskIT"
          fill
          priority
          sizes="(max-width: 768px) 110px, 130px"
          className="absolute inset-0 object-contain block dark:hidden"
        />

        {/* Logo para fondo oscuro */}
        <Image
          src="/logos/logo-taskit-dark.svg"
          alt="TaskIT"
          fill
          priority
          sizes="(max-width: 768px) 110px, 130px"
          className="absolute inset-0 object-contain hidden dark:block"
        />
      </div>
    </div>
  );
}
