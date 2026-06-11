import { describe, expect, it } from "vitest";
import {
  buildCandidateSkillInputs,
  buildJobSkillInputs,
  computeMatchScore,
  normalizeSkillKey,
} from "@/lib/ai/matchScore";

describe("match score taxonomy normalization", () => {
  it("normalizes accents, whitespace, and case for skill keys", () => {
    expect(normalizeSkillKey("  Node.JS  ")).toBe("node.js");
    expect(normalizeSkillKey("Gestion   de Datos")).toBe("gestion de datos");
  });

  it("matches skills by shared taxonomy term id first", () => {
    const result = computeMatchScore({
      jobSkills: [{ termId: "skill-react", label: "React", must: true, weight: 5 }],
      candidateSkills: [{ termId: "skill-react", label: "React.js", level: 5 }],
    });

    expect(result.score).toBe(100);
    expect(result.matchedCount).toBe(1);
    expect(result.details[0].matched).toBe(true);
  });

  it("matches taxonomy aliases when ids are not shared", () => {
    const result = computeMatchScore({
      jobSkills: [
        {
          termId: "job-react",
          label: "React",
          aliases: ["React.js", "ReactJS"],
          must: true,
          weight: 5,
        },
      ],
      candidateSkills: [{ termId: "candidate-reactjs", label: "reactjs", level: 5 }],
    });

    expect(result.score).toBe(100);
    expect(result.details[0].matched).toBe(true);
  });

  it("falls back to legacy job skills when taxonomy links are missing", () => {
    const jobSkills = buildJobSkillInputs([], ["ReactJS", "TypeScript"]);
    const candidateSkills = buildCandidateSkillInputs([
      {
        level: 5,
        term: { id: "skill-react", label: "React", aliases: ["ReactJS"] },
      },
      {
        level: 4,
        term: { id: "skill-ts", label: "TypeScript", aliases: ["TS"] },
      },
    ]);

    const result = computeMatchScore({ jobSkills, candidateSkills });

    expect(jobSkills).toHaveLength(2);
    expect(result.matchedCount).toBe(2);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });
});
