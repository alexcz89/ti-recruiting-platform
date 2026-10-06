import type {
  ApplicationDisposition,
  ApplicationStage,
  Prisma,
} from "@prisma/client";

type CanonicalApplicationOfferState = {
  stage: ApplicationStage | null;
  disposition: ApplicationDisposition | null;
};

export const APPLICATION_WITHOUT_CANONICAL_OFFER_WHERE = {
  OR: [
    { stage: null },
    { disposition: null },
    { stage: { not: "OFFER" } },
    { disposition: { not: "ACTIVE" } },
  ],
} satisfies Prisma.ApplicationWhereInput;

export function hasCanonicalApplicationOffer(
  application: CanonicalApplicationOfferState,
) {
  return application.stage === "OFFER" && application.disposition === "ACTIVE";
}
