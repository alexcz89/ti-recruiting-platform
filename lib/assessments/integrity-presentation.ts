
export type IntegrityInput = {
  severity?: string | null;
  severityScore?: number | null;
  multiSession?: boolean | null;
};

export type IntegrityPresentation = {
  kind: "NO_DATA" | "INSUFFICIENT" | "NO_SEVERITY_ALERT" | "REVIEW";
  label: string;
  details: string;
  requiresReview: boolean;
};

export function getIntegrityPresentation(
  attempt: IntegrityInput | null | undefined
): IntegrityPresentation {
  if (!attempt) {
    return {
      kind: "NO_DATA",
      label: "Sin datos",
      details: "No existe un intento asociado.",
      requiresReview: false,
    };
  }

  const severity = String(attempt.severity ?? "")
    .trim()
    .toUpperCase();

  const multiSession = attempt.multiSession === true;

  if (
    severity === "CRITICAL" ||
    severity === "SUSPICIOUS" ||
    multiSession
  ) {
    const details: string[] = [];

    if (severity === "CRITICAL") {
      details.push("Nivel crítico.");
    } else if (severity === "SUSPICIOUS") {
      details.push("Nivel sospechoso.");
    }

    if (multiSession) {
      details.push("Varias sesiones registradas.");
    }

    if (
      typeof attempt.severityScore === "number" &&
      Number.isFinite(attempt.severityScore)
    ) {
      details.push(`Indicador: ${attempt.severityScore}.`);
    }

    return {
      kind: "REVIEW",
      label: "Revisar señales",
      details: details.join(" "),
      requiresReview: true,
    };
  }

  if (severity === "NORMAL") {
    return {
      kind: "NO_SEVERITY_ALERT",
      label: "Sin alerta de severidad",
      details:
        "La clasificación NORMAL no descarta irregularidades.",
      requiresReview: false,
    };
  }

  return {
    kind: "INSUFFICIENT",
    label: "Sin datos suficientes",
    details: "No existe una clasificación de severidad reconocida.",
    requiresReview: false,
  };
}
