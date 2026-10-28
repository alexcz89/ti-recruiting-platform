// @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { AssessmentDateTime, formatAssessmentDateTime } from "@/app/assessments/AssessmentDateTime";

const instant = "2026-10-27T19:23:00.000Z";
const resolvedOptions = new Intl.DateTimeFormat().resolvedOptions();
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("formats the same UTC instant in Mexico City and Tokyo without changing the stored instant", () => {
  const date = new Date(instant);
  const mexico = formatAssessmentDateTime(date, "America/Mexico_City");
  const tokyo = formatAssessmentDateTime(date, "Asia/Tokyo");
  expect(mexico).toContain("27 oct 2026"); expect(mexico).toContain("1:23");
  expect(tokyo).toContain("28 oct 2026"); expect(tokyo).toContain("4:23");
  expect(mexico).not.toBe(tokyo); expect(date.toISOString()).toBe(instant);
});

it.each(["America/Mexico_City", "Asia/Tokyo"])("hydrates the UTC fallback safely before showing browser time in %s", async timeZone => {
  const html = renderToString(<AssessmentDateTime value={instant} />);
  expect(html).toContain("UTC"); expect(html).toContain("7:23");
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ ...resolvedOptions, timeZone });
  const errors: unknown[] = [];
  const consoleError = vi.spyOn(console, "error");
  const container = document.createElement("div"); document.body.appendChild(container); container.innerHTML = html;
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, <AssessmentDateTime value={instant} />, { onRecoverableError: error => errors.push(error) });
  });
  expect(container.textContent).toContain(formatAssessmentDateTime(instant, timeZone));
  expect(container.textContent).toContain("hora local");
  expect(container.querySelector("time")?.dateTime).toBe(instant);
  expect(errors).toEqual([]);
  expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match|server html/i);
  await act(async () => root!.unmount()); container.remove();
});

it.each([null, undefined, "invalid", new Date(NaN)])("shows no fictitious date for %s", value => {
  render(<AssessmentDateTime value={value} />);
  expect(screen.getByText("No disponible")).toBeTruthy(); expect(screen.queryByRole("time")).toBeNull();
});

it("keeps an explicitly labelled UTC fallback when browser zone detection fails", () => {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => { throw new Error("Unavailable"); });
  render(<AssessmentDateTime value={instant} />);
  expect(screen.getByRole("time").textContent).toContain("UTC");
  expect(screen.getByRole("time").textContent).toContain("7:23");
});
