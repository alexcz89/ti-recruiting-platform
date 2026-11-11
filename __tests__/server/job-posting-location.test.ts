import { describe, expect, it } from "vitest";
import { resolveJobPostingLocation } from "@/lib/seo/job-posting-location";

describe("JobPosting legacy location", () => {
  it("resolves historical Salesforce location", () => {
    expect(resolveJobPostingLocation({
      city: "Ciudad de México, México",
      location: "Ciudad de México, México",
      country: null,
    })).toEqual({
      city: "Ciudad de México",
      country: "MX",
    });
  });

  it("supports Mexico without accent", () => {
    expect(resolveJobPostingLocation({
      city: "Monterrey, Mexico",
      country: null,
    })).toEqual({
      city: "Monterrey",
      country: "MX",
    });
  });

  it("preserves explicit international country", () => {
    expect(resolveJobPostingLocation({
      city: "Austin",
      country: "US",
    })).toEqual({
      city: "Austin",
      country: "US",
    });
  });

  it("does not invent countries", () => {
    expect(resolveJobPostingLocation({
      city: "Austin",
      location: "Austin, Texas",
      country: null,
    })).toBeNull();
  });

  it("does not invent cities", () => {
    expect(resolveJobPostingLocation({
      city: null,
      location: "Remoto",
      country: null,
    })).toBeNull();
  });
});