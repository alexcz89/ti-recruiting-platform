// @vitest-environment happy-dom
import React, { StrictMode } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SignupMultiStep from "@/app/auth/signup/candidate/components/SignupMultiStep";
import { createCandidateImproved } from "@/app/auth/signup/candidate/actions";
import { ANALYTICS_EVENTS as events, track } from "@/lib/analytics";
import { toastError } from "@/lib/ui/toast";

vi.mock("@/lib/analytics", async (original) => ({ ...await original<object>(), track: vi.fn() }));
vi.mock("@/app/auth/signup/candidate/actions", () => ({ createCandidateImproved: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/ui/toast", () => ({ toastSuccess: vi.fn(), toastError: vi.fn() }));
// Exercise the real submit handler and validation, without unrelated location APIs.
vi.mock("@/app/auth/signup/candidate/components/Step3Professional", () => ({
  default: ({ onSubmit }: { onSubmit: () => void }) => <button onClick={onSubmit}>Crear cuenta</button>,
}));

beforeEach(() => {
  vi.stubGlobal("React", React);
  localStorage.clear();
  localStorage.setItem("signup_current_step_v1", "3");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("counts entry once in StrictMode", () => {
  render(<StrictMode><SignupMultiStep /></StrictMode>);
  expect(vi.mocked(track).mock.calls.map(([event]) => event)).toEqual([events.pageview, events.signupStarted]);
});

it("counts completion only after confirmed server success", async () => {
  let resolve!: (value: { ok: boolean; emailVerificationSent: boolean }) => void;
  vi.mocked(createCandidateImproved).mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<SignupMultiStep />);
  expect(vi.mocked(track).mock.calls.map(([event]) => event)).toEqual([events.pageview, events.signupStarted]);
  fireEvent.click(view.getByText("Crear cuenta"));
  expect(track).not.toHaveBeenCalledWith(events.signupCompleted);
  resolve({ ok: true, emailVerificationSent: true });
  await waitFor(() => expect(track).toHaveBeenCalledWith(events.signupCompleted));
  fireEvent.click(view.getByText("Crear cuenta"));
  await waitFor(() => expect(createCandidateImproved).toHaveBeenCalledTimes(2));
  expect(vi.mocked(track).mock.calls.filter(([event]) => event === events.signupCompleted)).toHaveLength(1);
  expect(vi.mocked(track).mock.calls.every((args) => args.length === 1)).toBe(true);
});

it.each(["rejected", "error"])("does not report completion for a %s signup", async (kind) => {
  if (kind === "rejected") vi.mocked(createCandidateImproved).mockResolvedValue({ ok: false, error: "Already registered" });
  else vi.mocked(createCandidateImproved).mockRejectedValue(new Error("Network unavailable"));
  const view = render(<SignupMultiStep />);
  fireEvent.click(view.getByText("Crear cuenta"));
  await waitFor(() => expect(toastError).toHaveBeenCalled());
  expect(track).not.toHaveBeenCalledWith(events.signupCompleted);
});

it("does not report completion when client validation fails", async () => {
  const view = render(<SignupMultiStep prefillData={{ phone: "invalid" }} />);
  fireEvent.click(view.getByText("Crear cuenta"));
  expect(createCandidateImproved).not.toHaveBeenCalled();
  expect(track).not.toHaveBeenCalledWith(events.signupCompleted);
});
