import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginRoleMismatchMessage } from "@/lib/auth/login";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class PrismaClient {
    user = { findUnique: mocks.findUnique };
  },
}));

delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
const { authOptions } = await import("@/lib/server/auth");

type LoginRole = "CANDIDATE" | "RECRUITER";

const credentialsProvider = authOptions.providers.find(
  (provider) => provider.id === "credentials"
);

if (!credentialsProvider || !("authorize" in credentialsProvider.options)) {
  throw new Error("Credentials provider is not configured");
}

const authorize = credentialsProvider.options.authorize;

function user(role: LoginRole) {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    name: role === "CANDIDATE" ? "Carolina" : "Rebeca",
    role,
    passwordHash: "hashed-password",
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
    recruiterProfile:
      role === "RECRUITER"
        ? { companyId: "company-1", status: "APPROVED" }
        : null,
  };
}

async function signInAs(accountRole: LoginRole, loginMode: LoginRole) {
  mocks.findUnique.mockResolvedValue(user(accountRole));

  return authorize(
    {
      email: `${accountRole.toLowerCase()}@example.com`,
      password: "correct-password",
      role: loginMode,
      rememberMe: "false",
    },
    {} as never
  );
}

describe("credentials login role enforcement", () => {
  beforeEach(() => {
    mocks.compare.mockResolvedValue(true);
  });

  it("rejects recruiter credentials in Candidate mode with a role-specific error", async () => {
    await expect(signInAs("RECRUITER", "CANDIDATE")).rejects.toThrow(
      "LOGIN_ROLE_MISMATCH:RECRUITER"
    );
  });

  it("rejects candidate credentials in Recruiter mode with a role-specific error", async () => {
    await expect(signInAs("CANDIDATE", "RECRUITER")).rejects.toThrow(
      "LOGIN_ROLE_MISMATCH:CANDIDATE"
    );
  });

  it("accepts recruiter credentials in Recruiter mode", async () => {
    await expect(signInAs("RECRUITER", "RECRUITER")).resolves.toMatchObject({
      id: "recruiter-1",
      role: "RECRUITER",
      companyId: "company-1",
    });
  });

  it("accepts candidate credentials in Candidate mode", async () => {
    await expect(signInAs("CANDIDATE", "CANDIDATE")).resolves.toMatchObject({
      id: "candidate-1",
      role: "CANDIDATE",
      companyId: null,
    });
  });

  it("provides clear role-specific messages without exposing password failures", () => {
    expect(loginRoleMismatchMessage("LOGIN_ROLE_MISMATCH:RECRUITER")).toBe(
      "Esta cuenta pertenece a un reclutador. Inicia sesión desde la sección Reclutador."
    );
    expect(loginRoleMismatchMessage("LOGIN_ROLE_MISMATCH:CANDIDATE")).toBe(
      "Esta cuenta pertenece a un candidato. Inicia sesión desde la sección Candidato."
    );
    expect(loginRoleMismatchMessage("CredentialsSignin")).toBeNull();
  });
});
