import { z } from "zod";

export const CONTEST_LANGUAGES = [
  { value: "PYTHON", label: "Python", runner: "python" },
  { value: "JAVASCRIPT", label: "JavaScript", runner: "javascript" },
  { value: "TYPESCRIPT", label: "TypeScript", runner: "typescript" },
  { value: "JAVA", label: "Java", runner: "java" },
] as const;

export type ContestLanguageValue = (typeof CONTEST_LANGUAGES)[number]["value"];

const optionalUrl = z.union([z.literal(""), z.string().trim().url("Ingresa una URL válida")]);

export const contestRegistrationSchema = z.object({
  language: z.enum(["PYTHON", "JAVASCRIPT", "TYPESCRIPT", "JAVA"]),
  city: z.string().trim().min(2, "Indica tu ciudad").max(120),
  experienceLevel: z.enum(["JUNIOR", "MID", "SENIOR", "LEAD"]),
  linkedinUrl: z.string().trim().url("Ingresa una URL válida de LinkedIn").max(300),
  githubUrl: optionalUrl.optional().default(""),
  rankingConsent: z.boolean().default(false),

  jobInterest: z.boolean().default(false),
  aiToolDisclosure: z.string().trim().max(200).optional().default(""),
  aiFreeCategory: z.boolean().default(false),
});

export type ContestRegistrationInput = z.infer<typeof contestRegistrationSchema>;

export type ContestWindow = {
  status: string;
  registrationOpens: Date | null;
  registrationCloses: Date | null;
  maxParticipants: number | null;
  registrationCount?: number;
};
export type ChallengeWindow = {
  status: string;
  challengeOpens: Date | null;
  challengeCloses: Date | null;
};

export function registrationAvailability(contest: ContestWindow, now = new Date()) {
  if (contest.status !== "REGISTRATION_OPEN") {
    return { open: false, reason: "El registro no está abierto" } as const;
  }
  if (contest.registrationOpens && now < contest.registrationOpens) {
    return { open: false, reason: "El registro aún no comienza" } as const;
  }
  if (contest.registrationCloses && now > contest.registrationCloses) {
    return { open: false, reason: "El registro ha cerrado" } as const;
  }
  if (
    contest.maxParticipants != null &&
    (contest.registrationCount ?? 0) >= contest.maxParticipants
  ) {
    return { open: false, reason: "Se alcanzó el cupo del concurso" } as const;
  }
  return { open: true, reason: null } as const;
}

export function challengeAvailability(contest: ChallengeWindow, now = new Date()) {
  if (["DRAFT", "CANCELLED", "COMPLETED"].includes(contest.status)) {
    return { open: false, reason: "El reto no está disponible" } as const;
  }
  if (contest.challengeOpens && now < contest.challengeOpens) {
    return { open: false, reason: "El reto aún no comienza" } as const;
  }
  if (contest.challengeCloses && now > contest.challengeCloses) {
    return { open: false, reason: "La etapa clasificatoria ha cerrado" } as const;
  }
  return { open: true, reason: null } as const;
}
export type ContestRankingEntry = {
  registrationId: string;
  candidateName: string | null;
  language: ContestLanguageValue;
  totalScore: number;
  timeSpent: number | null;
  submittedAt: Date | null;
};

export function publicContestName(name: string | null) {
  const parts = String(name ?? "Participante").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Participante";
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

export function rankContestEntries(entries: ContestRankingEntry[]) {
  return [...entries]
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      const aTime = a.timeSpent ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.timeSpent ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      const aSubmitted = a.submittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bSubmitted = b.submittedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aSubmitted !== bSubmitted) return aSubmitted - bSubmitted;
      return a.registrationId.localeCompare(b.registrationId);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      publicName: publicContestName(entry.candidateName),
    }));
}

export type ContestRegistrationForRanking = {
  id: string;
  finalScore: number;
  candidate: { name: string | null };
  track: { language: string };
  attempt: { timeSpent: number | null; submittedAt: Date | null } | null;
};

export function rankContestRegistrations(registrations: ContestRegistrationForRanking[]) {
  return rankContestEntries(
    registrations.map((registration) => ({
      registrationId: registration.id,
      candidateName: registration.candidate.name,
      language: registration.track.language as ContestLanguageValue,
      totalScore: registration.finalScore,
      timeSpent: registration.attempt?.timeSpent ?? null,
      submittedAt: registration.attempt?.submittedAt ?? null,
    }))
  );
}
export function contestLanguageLabel(language: string) {
  return CONTEST_LANGUAGES.find((item) => item.value === language)?.label ?? language;
}

export function contestLanguageRunner(language: string) {
  return CONTEST_LANGUAGES.find((item) => item.value === language)?.runner ?? "python";
}