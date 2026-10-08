import type {
  ApplicationDisposition,
  ApplicationStage,
  Prisma,
} from "@prisma/client";

type CanonicalBackwardProtectedState = {
  stage: ApplicationStage | null;
  disposition: ApplicationDisposition | null;
};

export const APPLICATION_WITHOUT_CANONICAL_INTERVIEW_WHERE = {
  OR: [
    { stage: null },
    { disposition: null },
    { stage: { not: "INTERVIEW" } },
    { disposition: { not: "ACTIVE" } },
  ],
} satisfies Prisma.ApplicationWhereInput;

export function hasCanonicalApplicationInterview(
  application: CanonicalBackwardProtectedState,
) {
  return (
    application.stage === "INTERVIEW" && application.disposition === "ACTIVE"
  );
}
