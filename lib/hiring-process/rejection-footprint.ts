import type {
  ApplicationDisposition,
  ApplicationInterest,
  ApplicationStage,
  ApplicationStatus,
  Prisma,
} from "@prisma/client";

type ApplicationRejectionState = {
  stage: ApplicationStage | null;
  disposition: ApplicationDisposition | null;
  status: ApplicationStatus;
  recruiterInterest: ApplicationInterest;
};

export const APPLICATION_REJECTION_FOOTPRINT_WHERE = {
  OR: [
    { stage: "CLOSED", disposition: "REJECTED" },
    { status: "REJECTED" },
    { recruiterInterest: "REJECTED" },
  ],
} satisfies Prisma.ApplicationWhereInput;

export const APPLICATION_WITHOUT_REJECTION_FOOTPRINT_WHERE = {
  AND: [
    { status: { not: "REJECTED" } },
    { recruiterInterest: { not: "REJECTED" } },
    {
      OR: [
        { stage: null },
        { disposition: null },
        { stage: { not: "CLOSED" } },
        { disposition: { not: "REJECTED" } },
      ],
    },
  ],
} satisfies Prisma.ApplicationWhereInput;

export function hasApplicationRejectionFootprint(
  application: ApplicationRejectionState,
) {
  return (
    (application.stage === "CLOSED" && application.disposition === "REJECTED") ||
    application.status === "REJECTED" ||
    application.recruiterInterest === "REJECTED"
  );
}
