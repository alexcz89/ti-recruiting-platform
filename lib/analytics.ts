/** Public, aggregate marketing analytics only. Never pass user or form data here. */
export const ANALYTICS_EVENTS = {
  pageview: "pageview",
  editorViewed: "landing_code_editor_viewed",
  howItWorksClicked: "landing_how_it_works_clicked",
  candidateExperienceViewed: "candidate_experience_section_viewed",
  demoClicked: "landing_demo_clicked",
  scroll25: "landing_scroll_25",
  scroll50: "landing_scroll_50",
  scroll75: "landing_scroll_75",
  scroll100: "landing_scroll_100",
  signupStarted: "candidate_signup_started",
  signupCompleted: "candidate_signup_completed",
} as const;

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[keyof typeof ANALYTICS_EVENTS];
export const ANALYTICS_PATHS = ["/", "/auth/signup/candidate"] as const;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
const passiveEvents: ReadonlySet<AnalyticsEvent> = new Set([
  ANALYTICS_EVENTS.editorViewed, ANALYTICS_EVENTS.candidateExperienceViewed,
  ANALYTICS_EVENTS.scroll25, ANALYTICS_EVENTS.scroll50,
  ANALYTICS_EVENTS.scroll75, ANALYTICS_EVENTS.scroll100,
]);

// A reviewed campaign vocabulary prevents arbitrary query strings (including PII)
// from leaving the browser. Unknown values are deliberately omitted.
export function marketingUrl(href: string, approvedValues: readonly string[]) {
  const input = new URL(href);
  if (!ANALYTICS_PATHS.some((path) => path === input.pathname)) return null;
  const output = new URL(input.pathname, input.origin);
  for (const key of UTM_KEYS) {
    const value = input.searchParams.get(key);
    if (value && /^[a-z0-9_-]{1,64}$/.test(value) && approvedValues.includes(value)) {
      output.searchParams.set(key, value);
    }
  }
  return output.href;
}

export function referrerOrigin(value: string) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : "";
  } catch { return ""; }
}

export function track(event: AnalyticsEvent) {
  if (typeof window === "undefined") return;
  try {
    if (!Object.values(ANALYTICS_EVENTS).includes(event)) return;
    if (navigator.doNotTrack === "1" ||
        (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
    const url = marketingUrl(window.location.href,
      (process.env.NEXT_PUBLIC_ANALYTICS_UTM_VALUES || "").split(",").map((value) => value.trim()));
    if (!url) return;
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    const payload = {
      name: event, domain, url, referrer: referrerOrigin(document.referrer),
      interactive: !passiveEvents.has(event),
    };
    // Debug mode is a local event stream, never a production transport.
    if (process.env.NODE_ENV !== "production") {
      if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true") {
        window.dispatchEvent(new CustomEvent("taskio:analytics", { detail: payload }));
      }
      return;
    }
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" || !domain ||
        window.location.hostname !== domain) return;
    // text/plain avoids CORS preflight. keepalive survives same-tab navigation.
    // No cookies, retries, identifiers, SDK, or third-party script execution.
    void fetch("https://plausible.io/api/event", {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload), keepalive: true, credentials: "omit",
      referrerPolicy: "no-referrer",
    }).catch(() => { /* Analytics must never interrupt the product. */ });
  } catch { /* Browser privacy settings or network failure must not affect UX. */ }
}

export function scrollMilestones(scrollTop: number, viewport: number, height: number) {
  if (height <= 0 || viewport <= 0) return [];
  const depth = Math.min(100, ((Math.max(0, scrollTop) + viewport + 1) / height) * 100);
  return ([
    [25, ANALYTICS_EVENTS.scroll25], [50, ANALYTICS_EVENTS.scroll50],
    [75, ANALYTICS_EVENTS.scroll75], [100, ANALYTICS_EVENTS.scroll100],
  ] as const).filter(([percent]) => depth >= percent).map(([, event]) => event);
}
