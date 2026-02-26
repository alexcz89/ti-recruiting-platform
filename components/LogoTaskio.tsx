// components/LogoTaskio.tsx
"use client";

import Image from "next/image";
import clsx from "clsx";

type LogoTaskioProps = {
  className?: string;
};

export default function LogoTaskio({ className }: LogoTaskioProps) {
  return (
    <div className="flex items-center shrink-0">
      <div
        className={clsx(
          // 🔥 Tamaño base mejorado (más presencia)
          "relative h-9 w-[140px] md:h-10 md:w-[160px]",
          className
        )}
      >
        {/* Logo fondo claro */}
        <Image
          src="/logos/logo-taskio-light.svg"
          alt="TaskIO"
          fill
          priority
          sizes="(max-width: 768px) 140px, 160px"
          className="object-contain block dark:hidden"
        />

        {/* Logo fondo oscuro */}
        <Image
          src="/logos/logo-taskio-dark.svg"
          alt="TaskIO"
          fill
          priority
          sizes="(max-width: 768px) 140px, 160px"
          className="object-contain hidden dark:block"
        />
      </div>
    </div>
  );
}