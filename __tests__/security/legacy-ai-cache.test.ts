import { describe, expect, it } from "vitest";
// @ts-expect-error next.config.mjs intentionally has no declaration file
import nextConfig from "@/next.config.mjs";
import { POST as analyzeCv } from "@/app/api/ai/analyze-cv/route";
import { POST as parseCv } from "@/app/api/ai/parse-cv/route";

describe("pilot API cache and retired AI endpoints", () => {
  it.each([analyzeCv, parseCv])("returns 410 with an effective no-store header", async (handler) => {
    const response = await handler();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).not.toContain("public");
  });

  it("sets a private no-store default for every API path", async () => {
    type HeaderRule = {
      source: string;
      headers: Array<{ key: string; value: string }>;
    };
    const headers = await (nextConfig as {
      headers?: () => Promise<HeaderRule[]>;
    }).headers?.();
    const apiRule = headers?.find((rule) => rule.source === "/api/:path*");
    const cacheHeader = apiRule?.headers.find((header) => header.key === "Cache-Control");
    expect(cacheHeader?.value).toBe("private, no-store, max-age=0, must-revalidate");
    expect(cacheHeader?.value).not.toContain("public");
  });
});
