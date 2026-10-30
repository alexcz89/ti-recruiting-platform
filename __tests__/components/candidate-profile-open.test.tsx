// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableMainFrameNavigation":true,"disableChildFrameNavigation":true,"disableChildPageNavigation":true}}}
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks }));
import CandidateProfileLink from "@/components/dashboard/CandidateProfileLink";
const source = { stage: "APPLIED" as const, disposition: "ACTIVE" as const, status: "SUBMITTED", recruiterInterest: "REVIEW", stateVersion: 1 };
const props = { href: "/dashboard/candidates/c?jobId=j&applicationId=a", applicationId: "a", jobId: "j", source, enabled: true };
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("does not mutate on render or prefetch, and sends exactly one POST on intentional activation", async () => {
  let resolve!: (r: Response) => void;
  const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>(done => { resolve = done; })); vi.stubGlobal("fetch", fetch);
  render(<CandidateProfileLink {...props}>Candidate</CandidateProfileLink>);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.mouseEnter(screen.getByRole("link")); expect(fetch).not.toHaveBeenCalled();
  // Keyboard Enter produces a click with detail=0 in the browser.
  fireEvent.click(screen.getByRole("link"), { detail: 0 });
  fireEvent.click(screen.getByRole("link"));
  expect(fetch).toHaveBeenCalledOnce(); expect(mocks.push).not.toHaveBeenCalled();
  expect(JSON.parse(String(fetch.mock.calls[0][1].body))).toMatchObject({ intent: "START_REVIEW", expectedVersion: 1 });
  await act(async () => resolve(new Response("{}")));
  expect(mocks.push).toHaveBeenCalledWith(props.href);
});
it.each(["network", "conflict"])("opens the profile despite %s failure", async failure => {
  const fetch = failure === "network" ? vi.fn().mockRejectedValue(new Error("offline")) : vi.fn().mockResolvedValue(new Response("{}", { status: 409 }));
  vi.stubGlobal("fetch", fetch);
  render(<CandidateProfileLink {...props}>Candidate</CandidateProfileLink>);
  fireEvent.click(screen.getByRole("link"));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(props.href));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ intent: "START_REVIEW", expectedVersion: 1, commandId: expect.any(String) });
});
it.each([{ ...source, stage: "REVIEW" as const, status: "REVIEWING", recruiterInterest: "MAYBE" }, { ...source, disposition: "HOLD" as const }, { ...source, status: "HIRED" }])("does not transition ineligible source %j", state => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<CandidateProfileLink {...props} href="#candidate" source={state}>Candidate</CandidateProfileLink>);
  fireEvent.click(screen.getByRole("link")); expect(fetch).not.toHaveBeenCalled();
});
it.each(["ctrl", "meta", "shift", "middle", "blank"])("leaves %s activation to native navigation without a blank tab or write", kind => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<CandidateProfileLink {...props} href="#candidate" target={kind === "blank" ? "_blank" : undefined}>Candidate</CandidateProfileLink>);
  if (kind === "blank") expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener");
  const event = new MouseEvent(kind === "middle" ? "auxclick" : "click", {
    bubbles: true, cancelable: true, button: kind === "middle" ? 1 : 0,
    ctrlKey: kind === "ctrl", metaKey: kind === "meta", shiftKey: kind === "shift",
  });
  fireEvent(screen.getByRole("link"), event);
  expect(event.defaultPrevented).toBe(false);
  expect(open).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});
it("keeps ADMIN/passive links as normal navigation", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<CandidateProfileLink {...props} href="#candidate" enabled={false}>Candidate</CandidateProfileLink>);
  fireEvent.click(screen.getByRole("link")); expect(fetch).not.toHaveBeenCalled();
});
