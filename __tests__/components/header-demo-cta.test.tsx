// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Header from "@/components/Header";
import { ANALYTICS_EVENTS } from "@/lib/analytics";

const state = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated" }), signOut: vi.fn() }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <button>Theme</button> }));
vi.mock("@/components/LogoTaskio", () => ({ default: () => <span>TaskIO</span> }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
beforeEach(() => { vi.stubGlobal("React", React); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("header demo CTA", () => {
  it.each(["/", "/contact"])("keeps the destination, analytics, sizing and mobile menu action on %s", path => {
    state.path = path; render(<Header />);
    const desktop = screen.getByRole("link", { name: "Solicitar demo" });
    expect(desktop.getAttribute("href")).toBe("/contact");
    expect(desktop.getAttribute("data-analytics-click")).toBe(ANALYTICS_EVENTS.demoClicked);
    expect(desktop.className).toContain("landing-header-demo");
    expect(desktop.className).toContain("min-h-11 px-4 text-sm");
    desktop.focus(); expect(document.activeElement).toBe(desktop);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const mobile = screen.getAllByRole("link", { name: "Solicitar demo" })[1];
    expect(mobile.getAttribute("href")).toBe("/contact");
    expect(mobile.getAttribute("data-analytics-click")).toBe(ANALYTICS_EVENTS.demoClicked);
    expect(mobile.className).toContain("landing-header-demo");
    fireEvent.click(mobile);
    expect(screen.queryByRole("navigation", { name: "Navegación móvil" })).toBeNull();
  });
});
