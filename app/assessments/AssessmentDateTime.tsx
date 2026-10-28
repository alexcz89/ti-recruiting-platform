"use client";

import { useEffect, useState } from "react";

const FALLBACK_TIME_ZONE = "UTC";

export function formatAssessmentDateTime(value: Date | string | null | undefined, timeZone: string) {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return null;
  }
}

export function AssessmentDateTime({ value }: { value: Date | string | null | undefined }) {
  // SSR and the first client render use identical, labelled UTC text.
  const [timeZone, setTimeZone] = useState(FALLBACK_TIME_ZONE);

  useEffect(() => {
    try {
      const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (browserTimeZone && formatAssessmentDateTime(value, browserTimeZone)) {
        setTimeZone(browserTimeZone);
      }
    } catch {
      // Keep the explicitly labelled UTC fallback if local-zone detection is unavailable.
    }
  }, [value]);

  const formatted = formatAssessmentDateTime(value, timeZone);
  if (!formatted || value == null) return <>No disponible</>;

  return (
    <time dateTime={new Date(value).toISOString()}>
      {formatted} <span className="text-xs text-zinc-600 dark:text-zinc-300">({timeZone === FALLBACK_TIME_ZONE ? "UTC" : "hora local"})</span>
    </time>
  );
}
