
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cvDeleteMany: vi.fn(),
  summaryDeleteMany: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    cvParseCache: {
      deleteMany: mocks.cvDeleteMany,
    },
    candidateSummaryCache: {
      deleteMany: mocks.summaryDeleteMany,
    },
  },
}));

import { GET } from "@/app/api/cron/cleanup/route";

function request(
  headers: Record<string, string> = {},
  path = "/api/cron/cleanup"
) {
  return new NextRequest(`http://localhost${path}`, {
    headers,
  });
}

describe("Cron de limpieza - autenticacion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");

    mocks.cvDeleteMany.mockResolvedValue({ count: 2 });
    mocks.summaryDeleteMany.mockResolvedValue({ count: 3 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("autoriza el Bearer token de Vercel", async () => {
    const response = await GET(
      request({ authorization: "Bearer test-cron-secret" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      cvCacheDeleted: 2,
      summaryCacheDeleted: 3,
    });

    expect(mocks.cvDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.summaryDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("conserva compatibilidad con x-cron-secret", async () => {
    const response = await GET(
      request({ "x-cron-secret": "test-cron-secret" })
    );

    expect(response.status).toBe(200);
    expect(mocks.cvDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.summaryDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("rechaza secretos incorrectos", async () => {
    const response = await GET(
      request({
        authorization: "Bearer incorrect-secret",
        "x-cron-secret": "incorrect-secret",
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.cvDeleteMany).not.toHaveBeenCalled();
    expect(mocks.summaryDeleteMany).not.toHaveBeenCalled();
  });

  it("rechaza solicitudes sin CRON_SECRET configurado", async () => {
    vi.stubEnv("CRON_SECRET", undefined);

    const response = await GET(
      request({ authorization: "Bearer test-cron-secret" })
    );

    expect(response.status).toBe(401);
    expect(mocks.cvDeleteMany).not.toHaveBeenCalled();
    expect(mocks.summaryDeleteMany).not.toHaveBeenCalled();
  });

  it("rechaza secretos enviados por la URL", async () => {
    const response = await GET(
      request(
        {},
        "/api/cron/cleanup?secret=test-cron-secret"
      )
    );

    expect(response.status).toBe(401);
    expect(mocks.cvDeleteMany).not.toHaveBeenCalled();
    expect(mocks.summaryDeleteMany).not.toHaveBeenCalled();
  });
});
