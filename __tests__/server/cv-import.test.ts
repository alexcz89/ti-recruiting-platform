import { describe, expect, it } from "vitest";
import {
  CvImportAnalysisSchema,
  educationFingerprint,
  experienceFingerprint,
  normalizeComparison,
  parseYearMonth,
  yearMonthFromDate,
} from "@/lib/profile/cv-import";

describe("CV import helpers", () => {
  it("normaliza acentos, mayúsculas y espacios para deduplicar", () => {
    expect(normalizeComparison("  Ingeniería   de Datos ")).toBe(
      "ingenieria de datos"
    );
  });

  it("genera fingerprints estables para experiencia y educación", () => {
    expect(
      experienceFingerprint({
        role: "Desarrollador Java",
        company: "Ácme",
        startDate: "2024-01",
      })
    ).toBe("desarrollador java|acme|2024-01");

    expect(
      educationFingerprint({
        institution: "Tecnológico de Monterrey",
        program: "Ingeniería",
        startDate: "2010-08",
      })
    ).toBe("tecnologico de monterrey|ingenieria|2010-08");
  });

  it("convierte sólo fechas YYYY-MM válidas", () => {
    const date = parseYearMonth("2025-07");
    expect(date?.toISOString()).toBe("2025-07-01T00:00:00.000Z");
    expect(yearMonthFromDate(date)).toBe("2025-07");
    expect(parseYearMonth("julio 2025")).toBeNull();
    expect(parseYearMonth("")).toBeNull();
  });

  it("valida y completa una respuesta parcial del parser", () => {
    const parsed = CvImportAnalysisSchema.parse({
      location: "Monterrey, Nuevo León",
      experiences: [
        {
          role: "Developer",
          company: "TaskIO",
          startDate: "2026-02",
          isCurrent: true,
        },
      ],
    });

    expect(parsed.experiences).toHaveLength(1);
    expect(parsed.skillsMatched).toEqual([]);
    expect(parsed.languages).toEqual([]);
    expect(parsed.phonePrimary).toBeNull();
  });

  it("rechaza fechas imposibles antes de persistirlas", () => {
    expect(() =>
      CvImportAnalysisSchema.parse({
        experiences: [
          {
            role: "Developer",
            company: "TaskIO",
            startDate: "2026-13",
          },
        ],
      })
    ).toThrow();
  });
});
