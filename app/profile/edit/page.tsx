// app/profile/edit/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "../ProfileForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect";
import path from "node:path";
import fs from "node:fs/promises";

// Catálogo central
import { getSkillsFromDB, getCertificationsFromDB } from "@/lib/skills";
// Geocoding (Mapbox)
import { geocodeCityToPoint } from "@/lib/geo";

// (opcional) si quieres mejorar el parse con libphonenumber también en server:
import { PhoneNumberUtil } from "google-libphonenumber";
const phoneUtil = PhoneNumberUtil.getInstance();

export const metadata = { title: "Mi perfil | Bolsa TI" };

/** Split E.164 a partes usando libphonenumber (fallback a heurística simple) */
function parseE164ToParts(e164?: string | null) {
  try {
    if (!e164) return { phoneCountry: "52", phoneLocal: "" };
    const parsed = phoneUtil.parse(e164);
    const cc = String(parsed.getCountryCode?.() ?? phoneUtil.getCountryCodeForRegion(phoneUtil.getRegionCodeForNumber(parsed)));
    const nsn = phoneUtil.getNationalSignificantNumber(parsed) || "";
    return { phoneCountry: cc, phoneLocal: nsn };
  } catch {
    // Fallback heurístico
    if (!e164) return { phoneCountry: "52", phoneLocal: "" };
    const digits = e164.replace(/\D+/g, "");
    if (digits.startsWith("52")) {
      const local10 = digits.slice(-10);
      return { phoneCountry: "52", phoneLocal: local10 };
    }
    let countryLen = 1;
    if (digits.length > 9) countryLen = 3;
    else if (digits.length > 8) countryLen = 2;
    const phoneCountry = digits.slice(0, countryLen) || "52";
    const phoneLocal = digits.slice(countryLen);
    return { phoneCountry, phoneLocal };
  }
}

/** Divide un nombre en {firstName, lastName1, lastName2} */
function splitName(full?: string | null) {
  const parts = (full ?? "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName1: "", lastName2: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName1: "", lastName2: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName1: parts[1], lastName2: "" };
  const lastName2 = parts.pop() as string;
  const lastName1 = parts.pop() as string;
  const firstName = parts.join(" ");
  return { firstName, lastName1, lastName2 };
}

export default async function ProfileEditPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=/profile/edit");

  const me = session.user as any;
  if (me.role === "RECRUITER" || me.role === "ADMIN") {
    redirect("/dashboard");
  }

  // Asegura registro (MVP)
  const dbUser = await prisma.user.upsert({
    where: { email: me.email! },
    update: {},
    create: {
      email: me.email!,
      name: me.name ?? me.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  });

  // Catálogos (server) → props del form
  const [skillsOptions, certOptions] = await Promise.all([
    getSkillsFromDB(),
    getCertificationsFromDB(),
  ]);

  // ---------- Server Action: actualizar perfil ----------
  async function updateAction(fd: FormData) {
    "use server";
    try {
      const s = await getServerSession(authOptions);
      if (!s?.user?.email) return { error: "No autenticado" };

      // ---------- Nombre ----------
      const firstName = String(fd.get("firstName") ?? "").trim();
      const lastName1 = String(fd.get("lastName1") ?? "").trim();
      const lastName2 = String(fd.get("lastName2") ?? "").trim();
      if (!firstName || !lastName1) {
        return { error: "Nombre y Apellido paterno son obligatorios." };
      }
      const fullName = lastName2 ? `${firstName} ${lastName1} ${lastName2}` : `${firstName} ${lastName1}`;

      const val = (k: string) => {
        if (!fd.has(k)) return undefined;
        const v = fd.get(k);
        if (v === null) return "";
        const str = String(v).trim();
        return str.length ? str : "";
      };

      // ---------- Teléfono ----------
      // Preferimos el E.164 directo del formulario (ya normalizado por el cliente).
      // Si no viene, usamos el fallback (país + local) y construimos E.164 simple.
      let phone: string | null | undefined = undefined;

      const phoneE164FromClient = val("phone"); // esperado en formato +XXXXXXXXXXX
      const isE164 = (p: string) => /^\+\d{7,15}$/.test(p);

      if (typeof phoneE164FromClient !== "undefined") {
        if (phoneE164FromClient === "") {
          phone = null; // explícitamente vacío
        } else if (isE164(phoneE164FromClient)) {
          phone = phoneE164FromClient;
        } else {
          return { error: "El teléfono no tiene un formato internacional válido (E.164)." };
        }
      } else if (fd.has("phoneCountry") || fd.has("phoneLocal")) {
        // Fallback legacy
        const phoneCountry = String(fd.get("phoneCountry") ?? "52").replace(/\D+/g, "");
        let phoneLocalDigits = String(fd.get("phoneLocal") ?? "").replace(/\D+/g, "");
        if (phoneLocalDigits) {
          phone = `+${phoneCountry}${phoneLocalDigits}`;
        } else {
          phone = null;
        }
      }

      // ---------- Fecha ----------
      let safeBirthdate: Date | null | undefined = undefined;
      if (fd.has("birthdate")) {
        const raw = String(fd.get("birthdate") ?? "");
        if (!raw) safeBirthdate = null;
        else {
          const d = new Date(raw);
          safeBirthdate = Number.isNaN(d.getTime()) ? null : d;
        }
      }

      // ---------- Payload ----------
      const data: any = {};
      data.name = fullName;
      if (typeof phone !== "undefined") data.phone = phone;

      // Ubicación + geocoding
      const location = val("location");
      if (typeof location !== "undefined") {
        data.location = location;
        if (location) {
          const pt = await geocodeCityToPoint(location);
          data.locationLat = pt?.lat ?? null;
          data.locationLng = pt?.lng ?? null;
        } else {
          data.locationLat = null;
          data.locationLng = null;
        }
      }

      if (typeof safeBirthdate !== "undefined") data.birthdate = safeBirthdate;
      const linkedin = val("linkedin");   if (typeof linkedin !== "undefined") data.linkedin = linkedin;
      const github = val("github");       if (typeof github !== "undefined") data.github = github;

      // CV: archivo o URL de texto
      if (fd.has("resume") && fd.get("resume") instanceof File) {
        const file = fd.get("resume") as File;
        if (file && file.size > 0) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const safeName = file.name.replace(/[^\w.\-]+/g, "_");
          const filename = `cv-${dbUser.id}-${Date.now()}-${safeName}`;
          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });
          const outPath = path.join(uploadsDir, filename);
          await fs.writeFile(outPath, buffer);
          data.resumeUrl = `/uploads/${filename}`;
        }
      } else {
        const resumeUrl = val("resumeUrl");
        if (typeof resumeUrl !== "undefined") data.resumeUrl = resumeUrl;
      }

      // Skills unificadas
      if (fd.has("skills")) {
        const csv = String(fd.get("skills") ?? "");
        const skills = csv.split(",").map((s) => s.trim()).filter(Boolean);
        data.skills = skills;
      }

      // Certificaciones
      if (fd.has("certifications")) {
        const csv = String(fd.get("certifications") ?? "");
        const certs = csv.split(",").map((s) => s.trim()).filter(Boolean);
        data.certifications = certs;
      }

      await prisma.user.update({ where: { id: dbUser.id }, data });

      revalidatePath("/profile/summary");
      redirect("/profile/summary?updated=1");
    } catch (err) {
      if (isRedirectError(err)) throw err;
      console.error("[profile:update] error", err);
      return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." };
    }
  }

  // Iniciales para el formulario (usa libphonenumber para separar)
  const parts = parseE164ToParts(dbUser.phone);
  const isMX = parts.phoneCountry === "52";
  const initialPhoneLocal = isMX
    ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10)
    : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15);

  const { firstName, lastName1, lastName2 } = splitName(dbUser.name);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
      <ProfileForm
        initial={{
          // nombre separado
          firstName,
          lastName1,
          lastName2,
          // demás campos
          email: dbUser.email,
          phoneCountry: parts.phoneCountry || "52",
          phoneLocal: initialPhoneLocal,
          location: dbUser.location ?? "",
          birthdate: dbUser.birthdate ? dbUser.birthdate.toISOString().slice(0, 10) : "",
          linkedin: dbUser.linkedin ?? "",
          github: dbUser.github ?? "",
          resumeUrl: dbUser.resumeUrl ?? "",
          skills: dbUser.skills ?? [],
          certifications: dbUser.certifications ?? [],
        }}
        // Catálogos centralizados
        skillsOptions={skillsOptions}
        certOptions={certOptions}
        onSubmit={updateAction}
      />
    </main>
  );
}
