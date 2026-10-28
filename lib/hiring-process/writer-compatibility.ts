export type ApplicationWriterCompatibility =
  | "CANONICAL"
  | "LEGACY"
  | "NONE";

/** Guard every legacy state write against a concurrent canonical conversion. */
export const LEGACY_APPLICATION_STATE_WHERE = {
  stage: null,
  disposition: null,
  stateVersion: 0,
} as const;

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
