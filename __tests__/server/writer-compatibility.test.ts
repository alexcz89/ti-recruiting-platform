import { describe, expect, it } from "vitest";

import { getApplicationWriterCompatibility } from "@/lib/hiring-process/writer-compatibility";

describe("getApplicationWriterCompatibility", () => {
  it("classifies complete canonical state as CANONICAL even at version 0", () => {
    expect(
      getApplicationWriterCompatibility({
        stage: "APPLIED",
        disposition: "ACTIVE",
        stateVersion: 0,
      }),
    ).toBe("CANONICAL");
  });

  it("classifies exact null/null/version-0 state as LEGACY", () => {
    expect(
      getApplicationWriterCompatibility({
        stage: null,
        disposition: null,
        stateVersion: 0,
      }),
    ).toBe("LEGACY");
  });

  it.each([
    { stage: "APPLIED", disposition: null, stateVersion: 0 },
    { stage: null, disposition: "ACTIVE", stateVersion: 0 },
    { stage: null, disposition: null, stateVersion: 1 },
  ])("classifies partial or inconsistent state as NONE: %o", (application) => {
    expect(getApplicationWriterCompatibility(application)).toBe("NONE");
  });
});