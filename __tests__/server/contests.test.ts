import { describe, expect, it } from "vitest";
import {
  challengeAvailability,
  contestRegistrationSchema,
  publicContestName,
  rankContestEntries,
  registrationAvailability,
} from "@/lib/contests/domain";
import { calculateAssessmentScore } from "@/lib/assessments/scoring";

describe("contest registration", () => {
  const openContest = {
    status: "REGISTRATION_OPEN",
    registrationOpens: new Date("2026-08-01T00:00:00Z"),
    registrationCloses: new Date("2026-09-01T00:00:00Z"),
    maxParticipants: 150,
    registrationCount: 12,
  };

  it("accepts registration only inside the configured window", () => {
    expect(registrationAvailability(openContest, new Date("2026-08-15T00:00:00Z"))).toEqual({ open: true, reason: null });
    expect(registrationAvailability(openContest, new Date("2026-09-02T00:00:00Z"))).toEqual({ open: false, reason: "El registro ha cerrado" });
  });

  it("closes registration when the participant cap is reached", () => {
    expect(registrationAvailability({ ...openContest, registrationCount: 150 }, new Date("2026-08-15T00:00:00Z"))).toEqual({ open: false, reason: "Se alcanzó el cupo del concurso" });
  });

  const validJuniorRegistration = {
    language: "PYTHON",
    city: "Monterrey",
    countryCode: "MX",
    timezone: "America/Monterrey",
    yearsExperience: 2,
    experienceLevel: "JUNIOR",
    linkedinUrl: "https://linkedin.com/in/candidate",
    githubUrl: "",
    rankingConsent: false,
    jobInterest: true,
    aiToolDisclosure: "",
    aiFreeCategory: false,
    eligibilityConfirmed: true,
    termsAccepted: true,
    privacyAccepted: true,
  } as const;

  it("accepts eligible junior candidates in Mexico", () => {
    expect(contestRegistrationSchema.safeParse(validJuniorRegistration).success).toBe(true);
  });

  it("rejects candidates with more than two years of experience", () => {
    const result = contestRegistrationSchema.safeParse({
      ...validJuniorRegistration,
      yearsExperience: 3,
    });
    expect(result.success).toBe(false);
  });

  it("requires eligibility, rules, and privacy acceptance", () => {
    for (const field of ["eligibilityConfirmed", "termsAccepted", "privacyAccepted"] as const) {
      const result = contestRegistrationSchema.safeParse({
        ...validJuniorRegistration,
        [field]: false,
      });
      expect(result.success).toBe(false);
    }
  });

  it("limits the first edition to Mexico and its supported time zones", () => {
    expect(contestRegistrationSchema.safeParse({
      ...validJuniorRegistration,
      countryCode: "US",
    }).success).toBe(false);
    expect(contestRegistrationSchema.safeParse({
      ...validJuniorRegistration,
      timezone: "America/New_York",
    }).success).toBe(false);
  });

  it("requires valid registration profile URLs", () => {
    const result = contestRegistrationSchema.safeParse({
      language: "PYTHON",
      city: "Monterrey",
      experienceLevel: "JUNIOR",
      linkedinUrl: "linkedin punto com",
      githubUrl: "",
      rankingConsent: false,
      jobInterest: true,
      aiToolDisclosure: "ChatGPT para documentación",
    });
    expect(result.success).toBe(false);
  });
});

describe("contest challenge window", () => {
  it("blocks attempts before opening and after closing", () => {
    const contest = {
      status: "REGISTRATION_OPEN",
      challengeOpens: new Date("2026-08-10T00:00:00Z"),
      challengeCloses: new Date("2026-08-20T00:00:00Z"),
    };
    expect(challengeAvailability(contest, new Date("2026-08-09T00:00:00Z")).open).toBe(false);
    expect(challengeAvailability(contest, new Date("2026-08-15T00:00:00Z")).open).toBe(true);
    expect(challengeAvailability(contest, new Date("2026-08-21T00:00:00Z")).open).toBe(false);
  });
});
describe("contest ranking", () => {
  it("sorts by score, elapsed time, and submission time", () => {
    const ranking = rankContestEntries([
      { registrationId: "slow", candidateName: "Ana López", language: "PYTHON", totalScore: 90, timeSpent: 2500, submittedAt: new Date("2026-08-10T12:00:00Z") },
      { registrationId: "lower", candidateName: "Luis Pérez", language: "JAVA", totalScore: 80, timeSpent: 1000, submittedAt: new Date("2026-08-10T10:00:00Z") },
      { registrationId: "fast", candidateName: "Mar Torres", language: "TYPESCRIPT", totalScore: 90, timeSpent: 1800, submittedAt: new Date("2026-08-10T13:00:00Z") },
    ]);
    expect(ranking.map((entry) => entry.registrationId)).toEqual(["fast", "slow", "lower"]);
    expect(ranking.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("publishes an abbreviated name", () => {
    expect(publicContestName("Carolina Torres Ruiz")).toBe("Carolina T.");
    expect(publicContestName(null)).toBe("Participante");
  });
});

describe("coding assessment scoring", () => {
  it("awards partial credit from coding test cases", () => {
    const result = calculateAssessmentScore(
      [{ id: "coding", section: "Reto", type: "CODING", testCases: Array.from({ length: 12 }, () => ({ points: 5 })) }],
      [{ questionId: "coding", pointsEarned: 45 }],
      { codingByTestCases: true }
    );
    expect(result.maxPoints).toBe(60);
    expect(result.totalScore).toBe(75);
  });

  it("preserves unit weighting for coding questions outside contests", () => {
    const result = calculateAssessmentScore(
      [{ id: "coding", section: "Reto", type: "CODING", testCases: Array.from({ length: 12 }, () => ({ points: 5 })) }],
      [{ questionId: "coding", pointsEarned: 45 }]
    );
    expect(result.maxPoints).toBe(1);
    expect(result.totalScore).toBe(100);
  });
  it("ignores answers outside the selected question set", () => {
    const result = calculateAssessmentScore(
      [{ id: "selected", section: "Base", type: "MULTIPLE_CHOICE", testCases: [] }],
      [
        { questionId: "selected", pointsEarned: 1 },
        { questionId: "outside", pointsEarned: 1 },
      ]
    );
    expect(result.totalPoints).toBe(1);
    expect(result.totalScore).toBe(100);
  });

  it("keeps conventional assessment questions at one point each", () => {
    const result = calculateAssessmentScore(
      [
        { id: "a", section: "Base", type: "MULTIPLE_CHOICE", testCases: [] },
        { id: "b", section: "Base", type: "MULTIPLE_CHOICE", testCases: [] },
      ],
      [{ questionId: "a", pointsEarned: 1 }]
    );
    expect(result.maxPoints).toBe(2);
    expect(result.totalScore).toBe(50);
  });
});