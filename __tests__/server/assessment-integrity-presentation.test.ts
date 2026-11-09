
import { describe, expect, it } from "vitest";
import { getIntegrityPresentation } from "@/lib/assessments/integrity-presentation";

describe("getIntegrityPresentation", () => {
  it("returns NO_DATA when there is no attempt", () => {
    const result = getIntegrityPresentation(null);

    expect(result.kind).toBe("NO_DATA");
    expect(result.label).toBe("Sin datos");
    expect(result.requiresReview).toBe(false);
  });

  it("returns INSUFFICIENT when severity is missing", () => {
    const result = getIntegrityPresentation({
      severity: null,
      multiSession: false,
    });

    expect(result.kind).toBe("INSUFFICIENT");
    expect(result.label).toBe("Sin datos suficientes");
    expect(result.requiresReview).toBe(false);
  });

  it("does not treat NORMAL as proof of no irregularities", () => {
    const result = getIntegrityPresentation({
      severity: "NORMAL",
      severityScore: 12,
      multiSession: false,
    });

    expect(result.kind).toBe("NO_SEVERITY_ALERT");
    expect(result.label).toBe("Sin alerta de severidad");
    expect(result.details).toContain("no descarta irregularidades");
    expect(result.requiresReview).toBe(false);
  });

  it("requires review for SUSPICIOUS severity", () => {
    const result = getIntegrityPresentation({
      severity: "SUSPICIOUS",
      severityScore: 55,
      multiSession: false,
    });

    expect(result.kind).toBe("REVIEW");
    expect(result.details).toContain("Nivel sospechoso");
    expect(result.requiresReview).toBe(true);
  });

  it("requires review for CRITICAL severity", () => {
    const result = getIntegrityPresentation({
      severity: "CRITICAL",
      severityScore: 90,
      multiSession: false,
    });

    expect(result.kind).toBe("REVIEW");
    expect(result.details).toContain("Nivel crítico");
    expect(result.requiresReview).toBe(true);
  });

  it("requires review for multiple sessions even with NORMAL severity", () => {
    const result = getIntegrityPresentation({
      severity: "NORMAL",
      severityScore: 30,
      multiSession: true,
    });

    expect(result.kind).toBe("REVIEW");
    expect(result.label).toBe("Revisar señales");
    expect(result.details).toContain("Varias sesiones");
    expect(result.requiresReview).toBe(true);
  });

  it("does not invent a severity score when it is absent", () => {
    const result = getIntegrityPresentation({
      severity: "SUSPICIOUS",
      severityScore: null,
    });

    expect(result.kind).toBe("REVIEW");
    expect(result.details).not.toContain("Indicador:");
  });

  it("does not treat an unknown severity as NORMAL", () => {
    const result = getIntegrityPresentation({
      severity: "UNKNOWN",
      multiSession: false,
    });

    expect(result.kind).toBe("INSUFFICIENT");
    expect(result.requiresReview).toBe(false);
  });
});
