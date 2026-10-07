function prismaErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : null;
}

export function isApplicationHistoryDeleteConflict(error: unknown) {
  const code = prismaErrorCode(error);
  if (code === "P2003" || code === "P2014") return true;

  const message = error instanceof Error ? error.message : "";
  return message.includes("ApplicationEvent_applicationId_fkey");
}

export function isSerializableDeleteConflict(error: unknown) {
  return prismaErrorCode(error) === "P2034";
}
