// app/assessments/[templateId]/AssessmentTimer.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";

type Props = {
  expiresAt: Date;
  onExpire: () => void;
};

export default function AssessmentTimer({ expiresAt, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diff = expires - now;
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onExpireRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const isLowTime = minutes < 5;
  const isCritical = minutes < 2;

  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold
        ${
          isCritical
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse"
            : isLowTime
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        }
      `}
    >
      <Clock className="h-5 w-5" />
      <span>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </div>
  );
}
