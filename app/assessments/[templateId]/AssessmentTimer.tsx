// app/assessments/[templateId]/AssessmentTimer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";

type Props = {
  expiresAt: Date | string | number;
  onExpire: () => void;
};

function toMs(d: Date | string | number) {
  const ms = d instanceof Date ? d.getTime() : new Date(d).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

export default function AssessmentTimer({ expiresAt, onExpire }: Props) {
  const onExpireRef = useRef(onExpire);
  const firedRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const expiresMs = useMemo(() => toMs(expiresAt), [expiresAt]);

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!Number.isFinite(expiresMs)) return 0;
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
  });

  useEffect(() => {
    firedRef.current = false;

    if (!Number.isFinite(expiresMs)) {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };

    // primer tick inmediato (por si cambió expiresAt)
    tick();

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresMs]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLowTime = timeLeft > 0 && minutes < 5;
  const isCritical = timeLeft > 0 && minutes < 2;

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold
        ${
          timeLeft === 0
            ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200"
            : isCritical
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse"
            : isLowTime
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        }
      `}
      aria-live="polite"
    >
      <Clock className="h-5 w-5" />
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
