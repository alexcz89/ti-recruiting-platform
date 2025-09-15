// app/profile/edit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ProfileForm";

export const metadata = { title: "Mi perfil | Bolsa TI" };

/**
 * Parser robusto E.164:
 * - Si empieza con +52 (o +521...), SIEMPRE tratamos como MX ("52")
 *   y dejamos el local en los ÚLTIMOS 10 dígitos.
 * - Para otros países: tomamos los primeros 1–3 dígitos como país y el resto como local.
 */
function parseE164ToParts(e164?: string | null) {
  if (!e164) return { phoneCountry: "52", phoneLocal: "" };
  const digits = e164.replace(/\D+/g, ""); // solo dígitos

  // Forzar MX si arranca con 52 (soporta legacy +521...)
  if (digits.startsWith("52")) {
    const local10 = digits.slice(-10); // últimos 10 dígitos
    return { phoneCountry: "52", phoneLocal: local10 };
  }

  // Genérico: país = 1–3 dígitos, local = resto (mínimo 6)
  // Elegimos 3 si hay >9 dígitos en total; 2 si >8; si no, 1.
  // (Heurística simple; suficiente para MVP)
  let countryLen = 1;
  if (digits.length > 9) countryLen = 3;
  else if (digits.length > 8) countryLen = 2;

  const phoneCountry = digits.slice(0, countryLen) || "52";
  const phoneLocal = digits.slice(countryLen);
  return { phoneCountry, phoneLocal };
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile");

  const user = session.user as any;

  // Solo candidatos en /profile; recruiter/admin → dashboard
  if (user?.role === "RECRUITER" || user?.role === "ADMIN") {
    redirect("/dashboard");
  }

  // Asegura usuario (primer login)
  const dbUser = await prisma.user.upsert({
    where: { email: user.email! },
    update: {},
    create: {
      email: user.email!,
      name: user.name ?? user.email!.split("@")[0],
      passwordHash: "demo",
      role: "CANDIDATE",
    },
  });

  // -------- Server Action: actualizar perfil --------
  async function updateAction(fd: FormData) {
    "use server";

    const toList = (k: string) =>
      String(fd.get(k) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const certsRaw = String(fd.get("certifications") || "");
    const certifications = certsRaw.split(",").map((s) => s.trim()).filter(Boolean);

    // Partes del teléfono desde el form
    let phoneCountry = String(fd.get("phoneCountry") || "52").replace(/\D+/g, "");
    const phoneLocalRaw = String(fd.get("phoneLocal") || "");
    let phoneLocalDigits = phoneLocalRaw.replace(/\D+/g, "");

    // Normalización extra por si llegan restos indebidos
    if (phoneCountry === "52") {
      // Si llegan más de 10, recortamos a los ÚLTIMOS 10 (y validamos)
      if (phoneLocalDigits.length > 10) {
        phoneLocalDigits = phoneLocalDigits.slice(-10);
      }
      if (phoneLocalDigits && phoneLocalDigits.length !== 10) {
        return { error: "Para México (+52), el número local debe tener exactamente 10 dígitos." };
      }
    } else {
      // Otros países: 6–15
      if (phoneLocalDigits && (phoneLocalDigits.length < 6 || phoneLocalDigits.length > 15)) {
        return { error: "El número local debe tener entre 6 y 15 dígitos." };
      }
    }

    // Normaliza a E.164
    const phoneE164 = phoneLocalDigits ? `+${phoneCountry}${phoneLocalDigits}` : null;

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        name: String(fd.get("name") || ""),
        phone: phoneE164, // E.164 en BD
        location: String(fd.get("location") || ""),
        birthdate: fd.get("birthdate") ? new Date(String(fd.get("birthdate"))) : null,
        linkedin: String(fd.get("linkedin") || ""),
        github: String(fd.get("github") || ""),
        resumeUrl: String(fd.get("resumeUrl") || ""),
        frontend: toList("frontend"),
        backend: toList("backend"),
        mobile: toList("mobile"),
        cloud: toList("cloud"),
        database: toList("database"),
        cybersecurity: toList("cybersecurity"),
        testing: toList("testing"),
        ai: toList("ai"),
        certifications,
      },
    });

    // Éxito → resumen
    redirect("/profile/summary");
  }

  // Iniciales para el form (con split robusto y saneados)
  const parts = parseE164ToParts(dbUser.phone);
  const isMX = parts.phoneCountry === "52";
  const initialPhoneLocal = isMX
    ? (parts.phoneLocal || "").replace(/\D+/g, "").slice(-10) // fuerza 10 para MX
    : (parts.phoneLocal || "").replace(/\D+/g, "").slice(0, 15);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Mi perfil</h1>
      <ProfileForm
        initial={{
          name: dbUser.name ?? "",
          email: dbUser.email,
          // Partes separadas, ya normalizadas
          phoneCountry: parts.phoneCountry || "52",
          phoneLocal: initialPhoneLocal,
          location: dbUser.location ?? "",
          birthdate: dbUser.birthdate ? dbUser.birthdate.toISOString().slice(0, 10) : "",
          linkedin: dbUser.linkedin ?? "",
          github: dbUser.github ?? "",
          resumeUrl: dbUser.resumeUrl ?? "",
          frontend: dbUser.frontend ?? [],
          backend: dbUser.backend ?? [],
          mobile: dbUser.mobile ?? [],
          cloud: dbUser.cloud ?? [],
          database: dbUser.database ?? [],
          cybersecurity: dbUser.cybersecurity ?? [],
          testing: dbUser.testing ?? [],
          ai: dbUser.ai ?? [],
          certifications: dbUser.certifications ?? [],
        }}
        onSubmit={updateAction}
      />
    </main>
  );
}
