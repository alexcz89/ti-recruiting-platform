// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeAssessmentDemo from "@/components/landing/CodeAssessmentDemo";

let container: HTMLDivElement;
let root: Root;

describe("CodeAssessmentDemo", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows the completed example immediately when reduced motion is preferred", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const intervalSpy = vi.spyOn(window, "setInterval");

    await act(async () => {
      root.render(<CodeAssessmentDemo />);
    });

    expect(container.textContent).toContain("8/8 tests passed");
    expect(container.textContent).toContain("87/100");
    expect(container.textContent).toContain("Advance");
    expect(
      container.querySelector('[aria-label="Simulación de una evaluación técnica de TaskIO"]'),
    ).not.toBeNull();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
