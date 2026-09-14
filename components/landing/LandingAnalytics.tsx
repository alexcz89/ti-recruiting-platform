"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_EVENTS as events, type AnalyticsEvent, scrollMilestones, track } from "@/lib/analytics";

/** No rendered DOM. One set per route visit, retained through StrictMode effects. */
export default function LandingAnalytics() {
  const pathname = usePathname();
  const visit = useRef<{ path: string | null; sent: Set<AnalyticsEvent> }>({ path: null, sent: new Set() });
  useEffect(() => {
    if (visit.current.path !== pathname) visit.current = { path: pathname, sent: new Set() };
    if (pathname !== "/") return;
    const once = (event: AnalyticsEvent) => {
      if (visit.current.sent.has(event)) return;
      visit.current.sent.add(event);
      track(event);
    };
    const pageview = () => {
      if (document.visibilityState !== "hidden") once(events.pageview);
    };
    pageview();
    let frame = 0;
    const scroll = () => {
      if (document.visibilityState === "hidden" || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scrollMilestones(window.scrollY, window.innerHeight, document.documentElement.scrollHeight).forEach(once);
      });
    };
    let observers: IntersectionObserver[] = [];
    const observe = () => {
      observers.forEach((observer) => observer.disconnect());
      observers = [];
      if (typeof IntersectionObserver === "undefined" || document.visibilityState === "hidden") return;
      for (const [selector, event] of [
        ["[data-analytics-editor]", events.editorViewed],
        ["#experiencia-candidato", events.candidateExperienceViewed],
      ] as const) {
        const target = document.querySelector(selector);
        if (!target || visit.current.sent.has(event)) continue;
        // Half the element or half the viewport, whichever is smaller: reachable on mobile.
        const ratio = Math.min(0.5, window.innerHeight * 0.5 / Math.max(1, target.getBoundingClientRect().height));
        const observer = new IntersectionObserver((entries) => {
          if (document.visibilityState === "hidden") return;
          if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= ratio)) {
            once(event);
            observer.disconnect();
          }
        }, { threshold: ratio });
        observer.observe(target);
        observers.push(observer);
      }
    };
    const refresh = () => { pageview(); observe(); scroll(); };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const name = event.target.closest("[data-analytics-click]")?.getAttribute("data-analytics-click");
      if (name === events.howItWorksClicked || name === events.demoClicked) track(name);
    };
    refresh();
    document.addEventListener("click", click, true);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      observers.forEach((observer) => observer.disconnect());
      cancelAnimationFrame(frame);
      document.removeEventListener("click", click, true);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);
  return null;
}
