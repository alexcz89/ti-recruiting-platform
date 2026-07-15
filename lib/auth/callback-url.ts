const INTERNAL_BASE_URL = "https://taskio.local";

export function sanitizeInternalCallbackUrl(
  value: unknown,
  fallback = ""
): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (candidate.includes("\\")) return fallback;

  try {
    const parsed = new URL(candidate, INTERNAL_BASE_URL);
    if (parsed.origin !== INTERNAL_BASE_URL) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildCandidateSignupHref(callbackUrl: string): string {
  const safeCallback = sanitizeInternalCallbackUrl(
    callbackUrl,
    "/certificaciones"
  );
  return `/auth/signup/candidate?callbackUrl=${encodeURIComponent(safeCallback)}`;
}
