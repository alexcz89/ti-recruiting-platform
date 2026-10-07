import type {
  ApplicationDisposition,
  ApplicationStage,
  ApplicationStatus,
  Prisma,
} from "@prisma/client";

type ApplicationHiredState = {
  stage: ApplicationStage | null;
  disposition: ApplicationDisposition | null;
  status: ApplicationStatus;
};

export const APPLICATION_HIRED_FOOTPRINT_WHERE = {
  OR: [
    { stage: "CLOSED", disposition: "HIRED" },
    { status: "HIRED" },
  ],
} satisfies Prisma.ApplicationWhereInput;

export const APPLICATION_WITHOUT_HIRED_FOOTPRINT_WHERE = {
  AND: [
    { status: { not: "HIRED" } },
    {
      OR: [
        { stage: null },
        { disposition: null },
        { stage: { not: "CLOSED" } },
        { disposition: { not: "HIRED" } },
      ],
    },
  ],
} satisfies Prisma.ApplicationWhereInput;

export function hasApplicationHiredFootprint(
  application: ApplicationHiredState,
) {
  return (
    (application.stage === "CLOSED" && application.disposition === "HIRED") ||
    application.status === "HIRED"
  );
}
