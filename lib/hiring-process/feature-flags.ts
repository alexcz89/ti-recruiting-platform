export function isCanonicalHiringProcessEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return environment.CANONICAL_HIRING_PROCESS_ENABLED === "true";
}
