// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Header from "@/components/Header";
import DashboardLayout from "@/app/dashboard/layout";
import ThemeProvider from "@/components/ThemeProvider";
import { MobileDrawer } from "@/components/ui/MobileDrawer";
import { DASHBOARD_NAV, isRecruiterDashboard } from "@/components/dashboard/navigation";

const state = vi.hoisted(() => ({ path: "/dashboard/jobs/demo", role: "RECRUITER", status: "authenticated", refresh: vi.fn(), signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: state.status, data: state.status === "authenticated" ? { user: { id: "synthetic", name: "Equipo Demo", role: state.role } } : null }), signOut: state.signOut }));
vi.mock("@/components/LogoTaskio", () => ({ default: () => <span>TaskIO</span> }));

let mediaChange: ((event: MediaQueryListEvent) => void) | undefined;
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  state.path = "/dashboard/jobs/demo"; state.role = "RECRUITER"; state.status = "authenticated";
  mediaChange = undefined; localStorage.clear();
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation(() => ({ matches: false,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { mediaChange = listener; }, removeEventListener: vi.fn() })));
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { count: 0, notifications: [], unreadCount: 0 }, badge: 0 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = ""; });

function Shell() { return <><Header /><DashboardLayout><h1>Contenido existente</h1></DashboardLayout></>; }

describe("recruiter dashboard presentation", () => {
  it("keeps the header minimal without removing its accessible controls", () => {
    render(<Shell />);
    const header = screen.getByRole("banner");
    expect(within(header).queryByText("Panel de reclutamiento")).not.toBeInTheDocument();
    expect(header.querySelector(".border-l")).toBeNull();
    const logo = within(header).getByRole("link", { name: "TaskIO, panel de reclutamiento" });
    expect(logo).toHaveAttribute("href", "/dashboard/overview");
    expect(within(header).getByRole("button", { name: "Abrir navegación del panel" })).toBeInTheDocument();
    for (const name of ["Notificaciones", "Menú de usuario", "Cambiar a tema oscuro"]) {
      const control = within(header).getByRole("button", { name });
      control.focus(); expect(control).toHaveFocus();
    }
  });

  it("uses the existing destinations, labels, current page and one notifications instance", async () => {
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-recruiter-shell]")).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Navegación del reclutador" });
    const destinations = DASHBOARD_NAV.flatMap(group => group.children ?? [group]).map(item => item.href);
    expect(within(navigation).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/dashboard/jobs/new", ...destinations]);
    expect(within(navigation).getByRole("link", { name: "Vacantes" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Notificaciones" })).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/notifications/unread-count")).toHaveLength(1);
    expect(state.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Contenido existente" })).toBeInTheDocument();
  });

  it("opens one modal navigation, traps focus, closes with Escape and restores focus", () => {
    render(<Shell />);
    const trigger = screen.getByRole("button", { name: "Abrir navegación del panel" });
    trigger.focus(); fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Navegación del panel" });
    const close = within(drawer).getByRole("button", { name: "Cerrar men\u00fa" });
    expect(close).toHaveFocus(); expect(trigger).toHaveAttribute("aria-expanded", "true");
    const last = within(drawer).getByRole("link", { name: "Facturas" });
    last.focus(); fireEvent.keyDown(last, { key: "Tab" }); expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/notifications/unread-count")).toHaveLength(1);
  });

  it("closes the mobile navigation on link activation and route change", () => {
    const view = render(<Shell />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación del panel" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Templates" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir navegación del panel" }));
    state.path = "/dashboard/assessments/templates"; view.rerender(<Shell />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("aria-current", "page");
  });

  it("keeps the account menu keyboard controlled and the existing profile and sign-out destinations", async () => {
    render(<Shell />);
    const trigger = screen.getByRole("button", { name: "Menú de usuario" });
    trigger.focus(); fireEvent.keyDown(trigger, { key: "Enter" });
    const profile = await screen.findByRole("menuitem", { name: "Mi perfil" });
    expect(profile).toHaveAttribute("href", "/dashboard/profile");
    fireEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesi\u00f3n" }));
    expect(state.signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("retains light/dark switching with a touch-sized control", () => {
    render(<ThemeProvider><Shell /></ThemeProvider>);
    const toggle = screen.getByRole("button", { name: "Cambiar a tema oscuro" });
    expect(toggle).toHaveClass("h-11", "w-11"); fireEvent.click(toggle);
    expect(document.documentElement).toHaveClass("dark");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar a tema claro" }));
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it.each(["ADMIN", "CANDIDATE"])("does not apply recruiter chrome to %s notifications", role => {
    state.role = role; state.path = "/dashboard/notifications";
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-recruiter-shell], [data-recruiter-header]")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Notifications" })).toHaveLength(1);
    if (role === "ADMIN") expect(screen.getAllByRole("link", { name: "Admin" }).length).toBeGreaterThan(0);
    else expect(screen.getByRole("link", { name: "Evaluaciones" })).toHaveAttribute("href", "/assessments");
  });

  it.each(["/", "/contact", "/jobs", "/assessments", "/assessments/template-demo"])("preserves the global header outside the recruiter dashboard: %s", path => {
    state.path = path;
    const { container } = render(<Header />);
    expect(container.querySelector("[data-recruiter-header]")).toBeNull();
    if (path === "/assessments/template-demo") expect(screen.getByText("Modo evaluación")).toBeInTheDocument();
  });

  it("does not infer a recruiter shell from pathname while the session is loading", () => {
    state.status = "loading";
    const { container } = render(<Shell />);
    expect(container.querySelector("[data-recruiter-shell], [data-recruiter-header]")).toBeNull();
    expect(isRecruiterDashboard("/dashboard-other", "RECRUITER")).toBe(false);
  });
});

describe("drawer lifecycle", () => {
  it("restores the previous scroll lock and closes if the viewport becomes desktop", () => {
    document.body.style.overflow = "clip";
    const close = vi.fn();
    const view = render(<MobileDrawer isOpen onClose={close} title="QA"><a href="/dashboard">Panel</a></MobileDrawer>);
    expect(document.body.style.overflow).toBe("hidden");
    // The listener reads the current MediaQueryList rather than the event payload.
    const media = vi.mocked(matchMedia).mock.results.slice(-1)[0]?.value;
    media.matches = true; mediaChange?.({ matches: true } as MediaQueryListEvent);
    expect(close).toHaveBeenCalledOnce();
    view.unmount(); expect(document.body.style.overflow).toBe("clip");
  });
});
