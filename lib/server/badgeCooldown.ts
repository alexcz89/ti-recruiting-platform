const BUILT_IN_BADGE_COOLDOWN_BYPASS_EMAILS = new Set([
  "alejandro.cz89@gmail.com",
]);

function configuredBypassEmails() {
  return new Set(
    String(process.env.BADGE_COOLDOWN_BYPASS_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isBadgeRetryCooldownBypassed(email?: string | null) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return false;

  return (
    BUILT_IN_BADGE_COOLDOWN_BYPASS_EMAILS.has(normalizedEmail) ||
    configuredBypassEmails().has(normalizedEmail)
  );
}