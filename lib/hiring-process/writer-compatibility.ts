export type ApplicationWriterCompatibility =
  | "CANONICAL"
  | "LEGACY"
  | "NONE";

export type ApplicationWriterCompatibilityInput = {
  stage: string | null;
  disposition: string | null;
  stateVersion: number;
};

export function getApplicationWriterCompatibility(
  application: ApplicationWriterCompatibilityInput,
): ApplicationWriterCompatibility {
  if (application.stage !== null && application.disposition !== null) {
    return "CANONICAL";
  }

  if (
    application.stage === null &&
    application.disposition === null &&
    application.stateVersion === 0
  ) {
    return "LEGACY";
  }

  return "NONE";
}