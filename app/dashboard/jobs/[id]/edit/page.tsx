// app/dashboard/jobs/[id]/edit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobWizard from "../../new/JobWizard";
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
import { geocodeCityToPoint } from "@/lib/geo";

export const dynamic = "force-dynamic";

type PageProps = { params: { id: string } };

/** Parseamos el bloque [Meta] que inyectamos en description */
function parseMetaFromDescription(desc: string) {
  // Esperamos líneas tipo key=value dentro del bloque [Meta]
  // Ejemplos:
  // showSalary=true; currency=MXN; salaryMin=100; salaryMax=200
  // employmentType=FULL_TIME; schedule=L-V 9-6
  // showBenefits=true; benefits={...json...}
  // responsibilities=...
  // certifications=["AWS SAA","CCNA"]
  const metaStart = desc.indexOf("\n---\n[Meta]\n");
  if (metaStart === -1) return {};
  const metaText = desc.slice(metaStart + "\n---\n[Meta]\n".length);
  const lines = metaText.split("\n").filter(Boolean);

  const out: any = {};
  for (const line of lines) {
    // partimos por ; y también por saltos de línea
    const parts = line.split(";").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const eq = p.indexOf("=");
      if (eq === -1) continue;
      const key = p.slice(0, eq).trim();
      const raw = p.slice(eq + 1).trim();

      // intenta JSON (para benefitsJson, certifications)
      if (key === "benefits" || key === "certifications") {
        try {
          out[key === "benefits" ? "benefitsJson" : "certs"] = JSON.parse(raw);
        } catch {
          // si no es JSON válido, ignora
        }
        continue;
      }

      // booleans
      if (raw === "true" || raw === "false") {
        out[key] = raw === "true";
        continue;
      }

      // números
      if (!Number.isNaN(Number(raw)) && raw !== "") {
        out[key] = Number(raw);
        continue;
      }

      // texto plano
      out[key] = raw;
    }
  }
  return out;
}

/** Convierte "Req: SkillA" | "Nice: SkillB" → [{name, required}] */
function deserializeSkills(skills: string[] | null | undefined) {
  const list = Array.isArray(skills) ? skills : [];
  return list
    .map((s) => {
      const m = s.match(/^(\s*Req:|\s*Nice:)\s*(.+)$/i);
      if (!m) return null;
      const required = /^req:/i.test(m[1]);
      return { name: m[2].trim(), required };
    })
    .filter(Boolean) as Array<{ name: string; required: boolean }>;
}

/** A partir de job.location y job.remote inferimos locationType + city */
function inferLocation(job: { location: string | null; remote: boolean }) {
  if (job.remote) return { locationType: "REMOTE" as const, city: "" };
  const loc = job.location || "";
  // esperamos "Híbrido · Ciudad" o "Presencial · Ciudad"
  if (loc.startsWith("Híbrido")) {
    const city = loc.split("·")[1]?.trim() || "";
    return { locationType: "HYBRID" as const, city };
  }
  if (loc.startsWith("Presencial")) {
    const city = loc.split("·")[1]?.trim() || "";
    return { locationType: "ONSITE" as const, city };
  }
  // fallback: tratamos todo como presencial con el texto completo como ciudad
  return { locationType: "ONSITE" as const, city: loc };
}

export default async function EditJobPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/jobs/${params.id}/edit`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  // Catálogos para autocompletar
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // Cargamos el job a editar
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      companyId: true,
      company: { select: { id: true, name: true } },
      location: true,
      remote: true,
      employmentType: true,
      description: true,
      skills: true,
      salaryMin: true,
      salaryMax: true,
      currency: true,
      recruiterId: true,
    },
  });

  if (!job) notFound();

  // Parse meta de description
  const meta = parseMetaFromDescription(job.description || "");
  const { locationType, city } = inferLocation(job);

  // Skills a estructura del Wizard
  const skillsForWizard = deserializeSkills(job.skills);

  // Certs desde meta
  const certsForWizard: string[] = Array.isArray(meta.certs) ? meta.certs : [];

  // showSalary (si no venía en meta, lo inferimos si hay rangos)
  const showSalary =
    typeof meta.showSalary === "boolean"
      ? meta.showSalary
      : Boolean(job.salaryMin || job.salaryMax);

  // Company “por defecto” del job
  const presetCompany = {
    id: job.company?.id ?? null,
    name: job.company?.name ?? null,
  };

  // ---------- Server Action: actualizar vacante ----------
  async function updateAction(fd: FormData) {
    "use server";

    const s = await getServerSession(authOptions);
    if (!s?.user?.email) return { error: "No autenticado" };

    // Paso 1
    const title = String(fd.get("title") || "").trim();
    const companyMode = String(fd.get("companyMode") || "own"); // own | other | confidential
    const companyOtherName = String(fd.get("companyOtherName") || "").trim();
    const newLocationType = String(fd.get("locationType") || "REMOTE"); // REMOTE | HYBRID | ONSITE
    const newCity = String(fd.get("city") || "").trim();
    const currency = (String(fd.get("currency") || "MXN") as "MXN" | "USD");
    const showSalary = String(fd.get("showSalary") || "false") === "true";
    const salaryMin = fd.get("salaryMin") ? Number(fd.get("salaryMin")) : null;
    const salaryMax = fd.get("salaryMax") ? Number(fd.get("salaryMax")) : null;

    if (!title) return { error: "Falta el nombre de la vacante." };
    if (!["REMOTE", "HYBRID", "ONSITE"].includes(newLocationType)) {
      return { error: "Ubicación inválida." };
    }
    if ((newLocationType === "HYBRID" || newLocationType === "ONSITE") && !newCity) {
      return { error: "Debes indicar la ciudad para vacantes híbridas o presenciales." };
    }
    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      return { error: "El sueldo mínimo no puede ser mayor que el máximo." };
    }

    // Paso 2
    const employmentType = String(fd.get("employmentType") || "FULL_TIME");
    const schedule = String(fd.get("schedule") || "").trim();

    // Paso 3 (prestaciones)
    const showBenefits = String(fd.get("showBenefits") || "false") === "true";
    const benefitsJson = String(fd.get("benefitsJson") || "{}");

    // Paso 4
    const description = String(fd.get("description") || "").trim();
    const responsibilities = String(fd.get("responsibilities") || "").trim();
    if (description.replace(/\s+/g, "").length < 50) {
      return { error: "La descripción debe tener al menos 50 caracteres." };
    }

    // skills: JSON de [{name, required}]
    const skillsJson = String(fd.get("skillsJson") || "[]");
    let parsedSkills: Array<{ name: string; required: boolean }> = [];
    try {
      parsedSkills = JSON.parse(skillsJson);
    } catch {
      parsedSkills = [];
    }
    const skills: string[] = parsedSkills.map((s) =>
      s.required ? `Req: ${s.name}` : `Nice: ${s.name}`
    );

    // certifications (opcional) JSON de string[]
    const certsJson = String(fd.get("certsJson") || "[]");
    let certs: string[] = [];
    try {
      certs = JSON.parse(certsJson);
    } catch {
      certs = [];
    }

    // companyId a utilizar:
    let companyIdToUse: string | null = null;

    // Cargamos al usuario para saber su companyId (por si elige "own")
    const me = await prisma.user.findUnique({
      where: { email: s.user!.email! },
      select: { companyId: true },
    });

    if (companyMode === "own" && me?.companyId) {
      companyIdToUse = me.companyId!;
    } else if (companyMode === "confidential") {
      const c = await prisma.company.upsert({
        where: { name: "Confidencial" },
        update: {},
        create: { name: "Confidencial" },
        select: { id: true },
      });
      companyIdToUse = c.id;
    } else if (companyMode === "other" && companyOtherName) {
      const c = await prisma.company.upsert({
        where: { name: companyOtherName },
        update: {},
        create: { name: companyOtherName },
        select: { id: true },
      });
      companyIdToUse = c.id;
    } else {
      // si no cambia, usamos la del job actual
      companyIdToUse = job.companyId ?? me?.companyId ?? null;
    }

    if (!companyIdToUse) {
      return { error: "No se pudo resolver la empresa para la vacante." };
    }

    // Normalizamos location final
    const remote = newLocationType === "REMOTE";
    const location = remote ? "Remoto" : `${newLocationType === "HYBRID" ? "Híbrido" : "Presencial"} · ${newCity}`;

    // Geocoding para guardar lat/lng (solo si no es remoto y hay ciudad)
    let locationLat: number | null = null;
    let locationLng: number | null = null;
    if (!remote && newCity) {
      const pt = await geocodeCityToPoint(newCity, "mx"); // puedes quitar "mx" si quieres generalizar
      if (pt) { locationLat = pt.lat; locationLng = pt.lng; }
    }

    // Inyectamos meta a la descripción
    const descWithMeta =
      description +
      `\n\n---\n[Meta]\n` +
      `showSalary=${showSalary}; currency=${currency}; salaryMin=${salaryMin ?? ""}; salaryMax=${salaryMax ?? ""}\n` +
      `employmentType=${employmentType}; schedule=${schedule}\n` +
      `showBenefits=${showBenefits}; benefits=${benefitsJson}\n` +
      `responsibilities=${responsibilities}\n` +
      `certifications=${JSON.stringify(certs)}\n`;

    await prisma.job.update({
      where: { id: job.id },
      data: {
        title,
        companyId: companyIdToUse,
        location,
        employmentType: employmentType as any,
        seniority: "MID", // si lo quieres editable, añade al Wizard y parsea
        description: descWithMeta,
        skills,
        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        currency,
        remote,
        locationLat,
        locationLng,
      },
      select: { id: true },
    });

    redirect("/dashboard/jobs");
  }

  // ---------- initial para el Wizard ----------
  const wizardInitial = {
    // Paso 1
    title: job.title || "",
    companyMode: "other", // default seguro; el Wizard mostrará el nombre con presetCompany
    companyOtherName: "", // si quieres, podrías setearlo con job.company?.name cuando no es "own"
    locationType,
    city,
    currency: (job.currency as "MXN" | "USD") || "MXN",
    salaryMin: job.salaryMin ?? "",
    salaryMax: job.salaryMax ?? "",
    showSalary,

    // Paso 2
    employmentType: (job.employmentType as any) || "FULL_TIME",
    schedule: typeof meta.schedule === "string" ? meta.schedule : "",

    // Paso 3
    showBenefits: typeof meta.showBenefits === "boolean" ? meta.showBenefits : false,
    benefitsJson: meta.benefitsJson || {},

    // Paso 4
    description: (job.description || "").split("\n---\n[Meta]\n")[0] || "",
    responsibilities: typeof meta.responsibilities === "string" ? meta.responsibilities : "",
    skills: skillsForWizard,
    certs: certsForWizard,
  };

  return (
    <main className="max-w-4xl">
      <h2 className="mb-4 text-lg font-semibold">Editar vacante</h2>
      <JobWizard
        onSubmit={updateAction}
        presetCompany={presetCompany}
        skillsOptions={skillsOptions}
        certOptions={certOptions}
        // ← Asegúrate de que JobWizard acepte este prop opcional y lo use como estado inicial
        //    sin romper el flujo de "nueva vacante".
        initial={wizardInitial as any}
      />
    </main>
  );
}
