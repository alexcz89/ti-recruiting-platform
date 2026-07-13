import { describe, expect, it } from "vitest";
import { buildLinkedInCertificationUrl } from "@/lib/badges";

const credential = {
  skill: "Java",
  level: 1,
  slug: "java-basic-demo123",
  earnedAt: new Date("2026-07-13T12:00:00Z"),
  appUrl: "https://www.taskio.com.mx",
};

describe("buildLinkedInCertificationUrl", () => {
  it("uses the TaskIO name while no official organization ID is configured", () => {
    const url = new URL(buildLinkedInCertificationUrl(credential));

    expect(url.searchParams.get("organizationName")).toBe("TaskIO");
    expect(url.searchParams.has("organizationId")).toBe(false);
    expect(url.searchParams.get("name")).toBe(
      "Certificación TaskIO en Java - Básico"
    );
    expect(url.searchParams.get("issueMonth")).toBe("7");
    expect(url.searchParams.get("issueYear")).toBe("2026");
    expect(url.searchParams.get("expirationMonth")).toBe("7");
    expect(url.searchParams.get("expirationYear")).toBe("2027");
    expect(url.searchParams.get("certUrl")).toBe(
      "https://www.taskio.com.mx/badge/java-basic-demo123"
    );
  });

  it("uses only the numeric LinkedIn organization ID when configured", () => {
    const url = new URL(
      buildLinkedInCertificationUrl({
        ...credential,
        organizationId: " 123456789 ",
      })
    );

    expect(url.searchParams.get("organizationId")).toBe("123456789");
    expect(url.searchParams.has("organizationName")).toBe(false);
  });

  it("ignores a non-numeric organization ID", () => {
    const url = new URL(
      buildLinkedInCertificationUrl({
        ...credential,
        organizationId: "taskio",
      })
    );

    expect(url.searchParams.get("organizationName")).toBe("TaskIO");
    expect(url.searchParams.has("organizationId")).toBe(false);
  });
});