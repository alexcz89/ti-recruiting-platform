// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodeEditorStory from "@/components/landing/CodeEditorStory";

let container: HTMLDivElement;
let root: Root;

describe("CodeEditorStory", () => {
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
      root.render(<CodeEditorStory />);
    });

    expect(container.textContent).toContain('recommendation: "advance"');
    expect(container.querySelector('[aria-label="Vista previa de un resultado técnico"]')).not.toBeNull();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
