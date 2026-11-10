type JobLocationInput = {
  city?: string | null;
  country?: string | null;
  location?: string | null;
};

const mexicoSuffix = /,\s*m[e\u00e9]xico\s*$/i;

export function resolveJobPostingLocation(job: JobLocationInput) {
  const city = job.city?.trim().replace(mexicoSuffix, "").trim() || null;

  const country =
    job.country?.trim().toUpperCase() ||
    (mexicoSuffix.test(job.location ?? "") ||
    mexicoSuffix.test(job.city ?? "")
      ? "MX"
      : null);

  if (!city || !country) return null;

  return { city, country };
}