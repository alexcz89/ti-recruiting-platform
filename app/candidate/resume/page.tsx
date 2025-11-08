// app/candidate/resume/page.tsx
import ResumeWizard from "@/components/resume/ResumeWizard";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const metadata = { title: "Creador de CV | Bolsa TI" };

function getBaseUrl() {
  // Prioriza variable de entorno si la tienes definida (útil en prod)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  // En dev/SSR construimos desde los headers
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) throw new Error("No host header found");
  return `${proto}://${host}`;
}

async function loadResume() {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/resume`, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    return {
      about: "",
      education: [],
      experience: [],
      skills: [],
      languages: [],
      certifications: [],
    };
  }
  return res.json();
}

export default async function CandidateResumePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/candidate/resume");
  }

  const initialData = await loadResume();

  return (
    <main className="min-h-screen bg-zinc-200/60 dark:bg-zinc-700/50 rounded">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Creador de CV Profesional</h1>
        <p className="mb-6 text-sm text-neutral-600">
          Completa tu experiencia, educación, habilidades e idiomas. Puedes guardar y continuar después.
        </p>
        <ResumeWizard initialData={initialData} />
      </div>
    </main>
  );
}
