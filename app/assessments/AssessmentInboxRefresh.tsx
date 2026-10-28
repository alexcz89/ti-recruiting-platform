"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ASSESSMENTS_UPDATED_EVENT } from "@/lib/client/assessment-updates";

// Runs in the persistent root header, including routes where the candidate badge is hidden.
// A refresh keeps the same pathname, so it cannot trigger another entry refresh.
export function useAssessmentInboxEntryRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const enteredInbox = pathname === "/assessments" && previousPathname.current !== pathname;
    previousPathname.current = pathname;
    if (enteredInbox) router.refresh();
  }, [pathname, router]);
}

export function AssessmentInboxRefresh() {
  const router = useRouter();
  useEffect(() => {
    let scheduled: number | undefined;
    const refresh = () => {
      if (scheduled !== undefined) return;
      scheduled = window.setTimeout(() => {
        scheduled = undefined;
        router.refresh();
      }, 50);
    };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    // Covers return from another tab and a document restored from the browser's back/forward cache.
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener(ASSESSMENTS_UPDATED_EVENT, refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearTimeout(scheduled);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener(ASSESSMENTS_UPDATED_EVENT, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [router]);
  return null;
}
