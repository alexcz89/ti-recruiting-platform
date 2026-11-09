
 // @vitest-environment happy-dom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  fetch: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.session,
}));

vi.mock("@/lib/server/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    assessmentAttempt: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers({
    host: "localhost:3026",
    cookie: "synthetic-session=qa",
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import Page from "@/app/dashboard/assessments/attempts/[attemptId]/results/page";

const noEvents = {
  tooFast: false,
  tabSwitches: 0,
  visibilityHidden: 0,
  copyAttempts: 0,
  pasteAttempts: 0,
  rightClicks: 0,
  focusLoss: 0,
  pageHides: 0,
  multiSession: false,
  severity: "NORMAL",
  severityScore: 0,
};

function setResults(anticheat?: typeof noEvents) {
  const data = {
    attempt: {
      id: "attempt-qa",
      status: "EVALUATED",
      totalScore: 72,
      passed: false,
      ...(anticheat === undefined ? {} : { anticheat }),
    },
    template: {
      id: "template-qa",
      title: "Evaluación técnica QA",
      passingScore: 80,
    },
    answers: [],
    stats: {
      answeredQuestions: 0,
      totalQuestions: 0,
    },
    summaryOnly: true,
  };

  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify(data), { status: 200 })
  );
}

async function renderPage() {
  render(await Page({ params: { attemptId: "attempt-qa" } }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("React", React);
  vi.stubGlobal("fetch", mocks.fetch);

  mocks.session.mockResolvedValue({
    user: { id: "recruiter-qa", role: "RECRUITER" },
  });

  mocks.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("assessment results integrity presentation", () => {
  it("does not invent NORMAL when anticheat is absent", async () => {
    setResults();
    await renderPage();

    expect(
      screen.getByText("Sin datos suficientes")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Sin alertas detectadas")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Sin alerta de severidad")
    ).not.toBeInTheDocument();
  });

  it("does not present NORMAL as a fraud-free guarantee", async () => {
    setResults({ ...noEvents });
    await renderPage();

    expect(
      screen.getByText("Sin alerta de severidad")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "No se muestran eventos individuales en este resumen."
      )
    ).toBeInTheDocument();
  });

  it("highlights multiple sessions even with NORMAL severity", async () => {
    setResults({
      ...noEvents,
      multiSession: true,
      severityScore: 30,
    });
    await renderPage();

    expect(screen.getByText("Revisar señales")).toBeInTheDocument();
    expect(
      screen.getByText(/Varias sesiones registradas/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Múltiples dispositivos/)
    ).toBeInTheDocument();
  });

  it.each([
    ["SUSPICIOUS", 55, "Nivel sospechoso"],
    ["CRITICAL", 90, "Nivel crítico"],
  ])("shows %s severity as reviewable evidence", async (
    severity,
    severityScore,
    description
  ) => {
    setResults({ ...noEvents, severity, severityScore });
    await renderPage();

    expect(screen.getByText("Revisar señales")).toBeInTheDocument();
    expect(screen.getByText(new RegExp(description))).toBeInTheDocument();
  });

  it("rejects candidate access before fetching results", async () => {
    mocks.session.mockResolvedValue({
      user: { id: "candidate-qa", role: "CANDIDATE" },
    });

    await expect(
      Page({ params: { attemptId: "attempt-qa" } })
    ).rejects.toThrow("NOT_FOUND");

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
