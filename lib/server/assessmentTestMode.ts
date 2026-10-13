/**
 * Allows untimed MCQ attempts only for explicitly authorized diagnostic tests.
 * Never applies to production deployments, badge exams, coding or mixed tests.
 * Existing attempts are never modified; only the expiry of new attempts changes.
 */
type UntimedMcqTestArgs = {
  email?: string | null;
  templateType: string;
  isBadgeExam: boolean;
};

type TestEnvironment = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  ASSESSMENT_TEST_UNTIMED_ENABLED?: string;
  ASSESSMENT_TEST_UNTIMED_EMAILS?: string;
};

function allowedCsvValue(csv: string | undefined, expected: string) {
  if (!expected) return false;
  return (csv ?? "")
    .split(",")
    .some((item) => item.trim().toLowerCase() === expected.toLowerCase());
}

export function isUntimedMcqTestAllowed(
  { email, templateType, isBadgeExam }: UntimedMcqTestArgs,
  env: TestEnvironment = process.env,
): boolean {
  const inPreview = env.VERCEL_ENV === "preview";
  const inLocalOrTest = env.VERCEL_ENV == null && env.NODE_ENV !== "production";

  if (!inPreview && !inLocalOrTest) return false;
  if (env.ASSESSMENT_TEST_UNTIMED_ENABLED !== "true") return false;
  if (templateType !== "MCQ" || isBadgeExam) return false;

  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  return allowedCsvValue(env.ASSESSMENT_TEST_UNTIMED_EMAILS, normalizedEmail);
}
