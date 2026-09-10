// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  router: { replace: vi.fn() },
  useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getSession: mocks.getSession,
  useSession: mocks.useSession,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

import SignInSessionGuard from "@/app/auth/signin/SignInSessionGuard";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function renderGuard() {
  await act(async () => {
    root.render(
      <SignInSessionGuard>
        <div>Formulario de acceso</div>
      </SignInSessionGuard>
    );
  });
}

function persistedPageEvent(type: "pagehide" | "pageshow") {
  const event = new Event(type);
  Object.defineProperty(event, "persisted", { value: true });
  return event;
}

describe("SignInSessionGuard", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.getSession.mockResolvedValue(null);
    mocks.useSession.mockReturnValue({ data: null, status: "unauthenticated" });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps the form hidden and redirects an authenticated recruiter", async () => {
    mocks.useSession.mockReturnValue({
      data: { user: { role: "RECRUITER" } },
      status: "authenticated",
    });

    await renderGuard();

    expect(container.textContent).toBe("");
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("rechecks the session when bfcache restores the page", async () => {
    mocks.getSession.mockResolvedValue({ user: { role: "CANDIDATE" } });
    await renderGuard();
    expect(container.textContent).toContain("Formulario de acceso");

    await act(async () => {
      window.dispatchEvent(persistedPageEvent("pageshow"));
      await Promise.resolve();
    });

    expect(container.textContent).toBe("");
    expect(mocks.router.replace).toHaveBeenCalledWith("/profile/summary");
  });

  it("shows the form again after a signed-out bfcache restore without looping", async () => {
    await renderGuard();

    await act(async () => {
      window.dispatchEvent(persistedPageEvent("pagehide"));
      window.dispatchEvent(persistedPageEvent("pageshow"));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Formulario de acceso");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
