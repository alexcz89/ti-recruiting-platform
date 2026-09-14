// @vitest-environment happy-dom
import React, { StrictMode } from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingAnalytics from "@/components/landing/LandingAnalytics";
import { ANALYTICS_EVENTS as events, marketingUrl, referrerOrigin, scrollMilestones, track } from "@/lib/analytics";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));
let received: string[];
const record = (event: Event) => received.push((event as CustomEvent).detail.name);
const observers: { callback: IntersectionObserverCallback; threshold: number; target?: Element; disconnect: () => void }[] = [];

beforeEach(() => {
  path = "/";
  received = [];
  observers.length = 0;
  window.history.replaceState({}, "", "/");
  vi.stubEnv("NEXT_PUBLIC_ANALYTICS_DEBUG", "true");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 4000 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  vi.stubGlobal("IntersectionObserver", class {
    entry: typeof observers[number];
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
      this.entry = { callback, threshold: options.threshold as number, disconnect: vi.fn() };
      observers.push(this.entry);
    }
    observe(target: Element) { this.entry.target = target; }
    disconnect() { this.entry.disconnect(); }
  });
  window.addEventListener("taskio:analytics", record);
});
afterEach(() => {
  cleanup();
  window.removeEventListener("taskio:analytics", record);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function fixture() {
  return <StrictMode><LandingAnalytics /><div data-analytics-editor="" />
    <section id="experiencia-candidato" />
    <a href="#experiencia-candidato" data-analytics-click={events.howItWorksClicked}><span>Ver cómo funciona</span></a>
    <a href="/contact" data-analytics-click={events.demoClicked}>Solicitar demo</a></StrictMode>;
}

describe("landing observations", () => {
  it("counts real view thresholds once, including StrictMode and re-entry", () => {
    render(fixture());
    expect(received).toEqual([events.pageview]);
    const active = observers.slice(-2);
    for (const observer of active) {
      const emit = (ratio: number) => observer.callback([
        { isIntersecting: ratio > 0, intersectionRatio: ratio, target: observer.target } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
      emit(0.1);
      expect(received).toEqual([events.pageview]);
    }
    for (const observer of active) {
      for (let i = 0; i < 2; i++) observer.callback([
        { isIntersecting: true, intersectionRatio: 0.75, target: observer.target } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    }
    expect(received).toEqual([events.pageview, events.editorViewed, events.candidateExperienceViewed]);
  });

  it("tracks clicks without preventing link behavior and resets on a new route visit", () => {
    const view = render(fixture());
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    view.getByText("Ver cómo funciona").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    fireEvent.click(view.getByText("Solicitar demo"));
    expect(received).toEqual([events.pageview, events.howItWorksClicked, events.demoClicked]);
    path = "/contact";
    view.rerender(fixture());
    fireEvent.click(view.getByText("Solicitar demo"));
    expect(received).toHaveLength(3);
    path = "/";
    window.history.replaceState({}, "", "/");
    view.rerender(fixture());
    expect(received.filter((name) => name === events.pageview)).toHaveLength(2);
  });

  it("does not count background views; foregrounding resumes measurement", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    render(fixture());
    expect(received).toEqual([]);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(received).toEqual([events.pageview]);
  });

  it("counts each scroll milestone only once and removes listeners on unmount", async () => {
    const view = render(fixture());
    Object.defineProperty(window, "scrollY", { configurable: true, value: 3200 });
    fireEvent.scroll(window);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    fireEvent.scroll(window);
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(received).toEqual([events.pageview, events.scroll25, events.scroll50, events.scroll75, events.scroll100]);
    view.unmount();
    fireEvent.scroll(window);
    observers.forEach((observer) => expect(observer.disconnect).toHaveBeenCalled());
  });
});

describe("transport and privacy", () => {
  it("removes all sensitive URLs, query values and referrer paths", () => {
    expect(marketingUrl("https://www.taskio.com.mx/?email=a@b.com&token=secret&utm_source=linkedin&utm_campaign=ana-perez#secret", ["linkedin"]))
      .toBe("https://www.taskio.com.mx/?utm_source=linkedin");
    expect(marketingUrl("https://www.taskio.com.mx/assessments/private-token", [])).toBeNull();
    expect(referrerOrigin("https://example.com/private/person?email=a@b.com#secret")).toBe("https://example.com");
    expect(referrerOrigin("mailto:a@b.com")).toBe("");
  });
  it("never sends to production in development", () => {
    track(events.demoClicked);
    expect(received).toEqual([events.demoClicked]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires production enablement and matching hostname; sends no credentials", () => {
    vi.stubEnv("NODE_ENV", "production");
    track(events.demoClicked);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", "another.example");
    track(events.demoClicked);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", window.location.hostname);
    track(events.demoClicked);
    expect(fetch).toHaveBeenCalledWith("https://plausible.io/api/event", expect.objectContaining({
      credentials: "omit", keepalive: true, referrerPolicy: "no-referrer",
    }));
    const payload = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(Object.keys(payload).sort()).toEqual(["domain", "interactive", "name", "referrer", "url"]);
  });
  it("honors privacy opt-out", () => {
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, get: () => "0" });
    vi.spyOn(navigator, "doNotTrack", "get").mockReturnValue("1");
    track(events.demoClicked);
    expect(received).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("tolerates network failures without changing the flow", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ANALYTICS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_PLAUSIBLE_DOMAIN", window.location.hostname);
    vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
    expect(() => track(events.demoClicked)).not.toThrow();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("calculates viewport-bottom depth, including exact bottom and short pages", () => {
    expect(scrollMilestones(0, 800, 4000)).toEqual([]);
    expect(scrollMilestones(200, 800, 4000)).toEqual([events.scroll25]);
    expect(scrollMilestones(1200, 800, 4000)).toEqual([events.scroll25, events.scroll50]);
    expect(scrollMilestones(2200, 800, 4000)).toHaveLength(3);
    expect(scrollMilestones(3200, 800, 4000)).toHaveLength(4);
    expect(scrollMilestones(0, 800, 700)).toHaveLength(4);
    expect(scrollMilestones(0, 800, 0)).toEqual([]);
  });
});
