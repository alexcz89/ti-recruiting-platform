// @vitest-environment happy-dom
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import Header from "@/components/Header";
import DashboardLayout from "@/app/dashboard/layout";

const state = vi.hoisted(() => ({ path: "/dashboard/overview", role: "RECRUITER", status: "loading", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: state.status, data: state.status === "authenticated" ? { user: { id: "synthetic", name: "Demo", role: state.role } } : null }), signOut: vi.fn() }));
vi.mock("@/components/LogoTaskio", () => ({ default: () => <span>TaskIO</span> }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => <button>Tema</button> }));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => <button>Notificaciones</button> }));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(JSON.stringify({ badge: 0 }), { status: 200 })));
  state.path = "/dashboard/overview"; state.status = "loading"; state.role = "RECRUITER";
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Shell() { return <><Header /><DashboardLayout><h1>Contenido autorizado por el servidor</h1></DashboardLayout></>; }

describe("dashboard session transitions", () => {
  it.each(["/dashboard", "/dashboard/overview", "/dashboard/jobs", "/dashboard/notifications"])("does not emit public navigation or the old shell in the initial SSR HTML: %s", path => {
    state.path = path;
    const html = renderToString(<Shell />);
    expect(html).not.toContain("Coding Challenge");
    expect(html).not.toContain("Certificaciones");
    expect(html).not.toContain("Acceder");
    expect(html).not.toContain("Publicar vacante");
    expect(html).toContain("Cargando sesión");
    expect(html).toContain("Contenido autorizado por el servidor");
  });

  it("uses compact chrome on the authenticated signin redirect and keeps it through dashboard session loading", () => {
    state.path = "/auth/signin"; state.status = "unauthenticated";
    const view = render(<Header />);
    expect(screen.getByRole("link", { name: "Coding Challenge" })).toBeInTheDocument();
    state.status = "authenticated"; view.rerender(<Header />);
    expect(screen.queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    state.path = "/dashboard/overview"; state.status = "loading"; view.rerender(<Header />);
    expect(screen.queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Cargando sesión");
    state.status = "authenticated"; view.rerender(<Header />);
    expect(screen.getByRole("button", { name: "Menú de usuario" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["ADMIN", "CANDIDATE"])("resolves the correct %s controls without public header navigation", role => {
    const view = render(<Shell />);
    expect(screen.queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    state.role = role; state.status = "authenticated"; state.path = "/dashboard/notifications"; view.rerender(<Shell />);
    expect(within(screen.getByRole("banner")).queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegación del reclutador" })).not.toBeInTheDocument();
    if (role === "ADMIN") expect(screen.getAllByRole("link", { name: "Admin" }).length).toBeGreaterThan(0);
    else expect(screen.getByRole("link", { name: "Evaluaciones" })).toHaveAttribute("href", "/assessments");
  });

  it("does not fall back to public controls if a dashboard session becomes unavailable", () => {
    state.status = "authenticated";
    const view = render(<Shell />);
    state.status = "unauthenticated"; view.rerender(<Shell />);
    expect(screen.queryByRole("link", { name: "Coding Challenge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acceder" })).not.toBeInTheDocument();
    state.path = "/"; view.rerender(<Header />);
    expect(screen.getByRole("link", { name: "Acceder" })).toBeInTheDocument();
  });

  it("keeps existing content mounted as the recruiter session resolves", () => {
    const view = render(<><Header /><DashboardLayout><input aria-label="Borrador local" defaultValue="" /></DashboardLayout></>);
    const input = screen.getByRole("textbox", { name: "Borrador local" });
    fireEvent.change(input, { target: { value: "Sin guardar" } });
    state.status = "authenticated";
    view.rerender(<><Header /><DashboardLayout><input aria-label="Borrador local" defaultValue="" /></DashboardLayout></>);
    expect(screen.getByRole("textbox", { name: "Borrador local" })).toBe(input);
    expect(input).toHaveValue("Sin guardar");
  });

  it("retains the public signin header for candidates navigating to public jobs", () => {
    state.path = "/auth/signin"; state.role = "CANDIDATE"; state.status = "authenticated";
    render(<Header />);
    expect(screen.getByRole("link", { name: "Coding Challenge" })).toBeInTheDocument();
  });

  it.each(["ADMIN", "CANDIDATE"])("preserves the %s profile destination inside the dashboard account menu", async role => {
    state.role = role; state.status = "authenticated"; state.path = "/dashboard/notifications";
    render(<Header />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Menú de usuario" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Mi perfil" })).toHaveAttribute("href", role === "CANDIDATE" ? "/profile/summary" : "/dashboard/profile");
  });
});
