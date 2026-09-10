type AssessmentInvitationTarget = {
  templateId?: unknown;
  token?: unknown;
  inviteUrl?: unknown;
};

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function assessmentInvitationPath(target: AssessmentInvitationTarget) {
  const templateId = nonEmptyString(target.templateId);
  let token = nonEmptyString(target.token);

  if (!token) {
    const legacyInviteUrl = nonEmptyString(target.inviteUrl);
    if (legacyInviteUrl) {
      try {
        token = nonEmptyString(
          new URL(legacyInviteUrl, "http://localhost").searchParams.get("token"),
        );
      } catch {
        // Invalid legacy metadata falls through to the safe assessment route.
      }
    }
  }

  if (templateId && token) {
    return `/assessments/${encodeURIComponent(templateId)}?token=${encodeURIComponent(token)}`;
  }

  return templateId
    ? `/assessments/${encodeURIComponent(templateId)}`
    : "/assessments";
}
