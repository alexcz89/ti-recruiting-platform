export type LoginMode = "CANDIDATE" | "RECRUITER";

export const RECRUITER_SIGNIN_DESTINATION = "/dashboard/overview";
export const CANDIDATE_SIGNIN_DESTINATION = "/profile/summary";

export function parseLoginMode(value: unknown): LoginMode | null {
  return value === "CANDIDATE" || value === "RECRUITER" ? value : null;
}

export function accountRoleMatchesLoginMode(
  accountRole: string,
  loginMode: LoginMode
): boolean {
  if (accountRole === "ADMIN") return loginMode === "RECRUITER";
  return accountRole === loginMode;
}

export function authenticatedSigninDestination(role: unknown): string {
  const normalizedRole = String(role ?? "").toUpperCase();

  if (normalizedRole === "RECRUITER" || normalizedRole === "ADMIN") {
    return RECRUITER_SIGNIN_DESTINATION;
  }

  if (normalizedRole === "CANDIDATE") {
    return CANDIDATE_SIGNIN_DESTINATION;
  }

  return "/";
}

export function loginRoleMismatchMessage(error: string | null | undefined) {
  if (error?.includes("LOGIN_ROLE_MISMATCH:CANDIDATE")) {
    return "Esta cuenta pertenece a un candidato. Inicia sesión desde la sección Candidato.";
  }

  if (
    error?.includes("LOGIN_ROLE_MISMATCH:RECRUITER") ||
    error?.includes("LOGIN_ROLE_MISMATCH:ADMIN")
  ) {
    return "Esta cuenta pertenece a un reclutador. Inicia sesión desde la sección Reclutador.";
  }

  return null;
}
