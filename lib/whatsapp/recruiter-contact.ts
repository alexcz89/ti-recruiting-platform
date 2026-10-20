export type RecruiterWhatsappJob = {
  title: string | null;
  companyConfidential: boolean;
  company: { name: string | null } | null;
};

export type RecruiterWhatsappContactInput = {
  phone: string | null;
  candidateName: string | null;
  recruiterName: string | null;
  job: RecruiterWhatsappJob | null;
};

function firstName(value: string | null, fallback: string) {
  return value?.trim().split(/\s+/)[0] || fallback;
}

export function buildRecruiterWhatsappMessage(
  input: Omit<RecruiterWhatsappContactInput, "phone">,
) {
  const candidateName = firstName(input.candidateName, "candidato/a");
  const recruiterName = firstName(input.recruiterName, "Reclutamiento");
  const jobTitle = input.job?.title?.trim() || "la vacante";
  const companyName = input.job?.companyConfidential === false
    ? input.job.company?.name?.trim() || null
    : null;
  const recruiterIntroduction = companyName
    ? `soy ${recruiterName} de ${companyName}`
    : `soy ${recruiterName}`;

  return (
    `Hola ${candidateName}, ${recruiterIntroduction}. ` +
    `Te contacto porque te postulaste a la vacante de ${jobTitle}. ` +
    "¿Tienes disponibilidad para platicar?"
  );
}

export function normalizeMexicanWhatsappPhone(phone: string | null) {
  let normalized = phone?.replace(/\D/g, "") || "";
  if (normalized.length === 10) normalized = `52${normalized}`;
  if (normalized.length === 13 && normalized.startsWith("521")) {
    normalized = `52${normalized.slice(3)}`;
  }
  return normalized;
}

export function buildRecruiterWhatsappHref(input: RecruiterWhatsappContactInput) {
  const phone = normalizeMexicanWhatsappPhone(input.phone);
  if (!phone) return null;

  const message = buildRecruiterWhatsappMessage(input);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
