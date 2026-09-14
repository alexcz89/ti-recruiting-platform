import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { resetActionRateLimit } from "@/lib/server/rate-limit";

const mailerMocks = vi.hoisted(() => ({
  sendDemoRequestEmail: vi.fn(),
}));

vi.mock("@/lib/server/mailer", () => mailerMocks);

import { POST } from "@/app/api/contact/route";

const payload = {
  name: "Ana Torres",
  company: "Acme México",
  email: "ana@acme.mx",
  role: "People Lead",
  hiringNeeds: "Dos desarrolladores backend senior",
  message: "Queremos conocer las evaluaciones.",
  website: "",
};
const ip = "198.51.100.42";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      "x-forwarded-for": ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mailerMocks.sendDemoRequestEmail.mockResolvedValue({ ok: true, id: "email-1" });
  });

  afterEach(() => {
    resetActionRateLimit("demo-request-email", payload.email);
    resetActionRateLimit("demo-request-ip", ip);
  });

  it("envía datos validados y confirma sólo cuando el proveedor acepta el correo", async () => {
    const response = await POST(request({ ...payload, email: "ANA@ACME.MX" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mailerMocks.sendDemoRequestEmail).toHaveBeenCalledWith({
      ...payload,
      email: "ana@acme.mx",
    });
  });

  it("rechaza datos inválidos sin intentar enviar correo", async () => {
    const response = await POST(request({ ...payload, email: "invalid" }));

    expect(response.status).toBe(400);
    expect(mailerMocks.sendDemoRequestEmail).not.toHaveBeenCalled();
  });

  it("bloquea el honeypot", async () => {
    const response = await POST(request({ ...payload, website: "https://spam.test" }));

    expect(response.status).toBe(400);
    expect(mailerMocks.sendDemoRequestEmail).not.toHaveBeenCalled();
  });

  it("limita solicitudes repetidas por correo", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await POST(request(payload))).status).toBe(200);
    }

    const response = await POST(request(payload));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(mailerMocks.sendDemoRequestEmail).toHaveBeenCalledTimes(3);
  });

  it("no presenta una entrega omitida o fallida como conversión", async () => {
    mailerMocks.sendDemoRequestEmail.mockResolvedValue({
      skipped: true,
      reason: "disabled",
    });

    const response = await POST(request(payload));
    expect(response.status).toBe(503);
    expect((await response.json()).ok).not.toBe(true);
  });

  it("rechaza solicitudes entre orígenes", async () => {
    const response = await POST(request(payload, { Origin: "https://evil.example" }));

    expect(response.status).toBe(403);
    expect(mailerMocks.sendDemoRequestEmail).not.toHaveBeenCalled();
  });
});
