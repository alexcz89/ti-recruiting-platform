// components/dashboard/assessments/AutoRefresh.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Auto-refresca la página cada `intervalMs` ms cuando hay evaluaciones en progreso.
 */
export default function AutoRefresh({
  intervalMs = 30_000,
  hasInProgress,
}: {
  intervalMs?: number;
  hasInProgress: boolean;
}) {
  const router = useRouter();
  const seconds = Math.round(intervalMs / 1000);
  const [countdown, setCountdown] = useState(seconds);
  const countRef = useRef(seconds);

  useEffect(() => {
    if (!hasInProgress) return;

    countRef.current = seconds;
    setCountdown(seconds);

    const tick = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) {
        router.refresh();
        countRef.current = seconds;
        setCountdown(seconds);
      }
    }, 1000);

    return () => clearInterval(tick);
  }, [hasInProgress, seconds, router]);

  if (!hasInProgress) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
      <span>Actualización en {countdown}s</span>
    </div>
  );
}
