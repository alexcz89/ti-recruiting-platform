// app/jobs/[id]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fromNow } from "@/lib/dates"; // ⬅️ helper date-fns
import { sendApplicationSubmittedEmail } from "@/lib/mailer"; // ⬅️ notificación al candidato

export default async function JobDetail({ params }: { params: { id: string } }) {
  // 1) Cargar la vacante con la relación a Company
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      location: true,
      employmentType: true,
      seniority: true,
      remote: true,
      description: true,
      skills: true,
      updatedAt: true,
      company: { select: { name: true } },
    },
  });
  if (!job) notFound();

  // 2) Leer sesión (si existe) para decidir qué UI mostrar
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const isCandidate = role === "CANDIDATE";

  // 3) Server Action para postularse (sin carta ni CV)
  async function applyAction() {
    "use server";
    const s = await getServerSession(authOptions);

    // Sin sesión → pedir login como candidato
    if (!s?.user?.email) {
      return {
        error: "AUTH",
        signinUrl: `/signin?role=CANDIDATE&callbackUrl=/jobs/${params.id}`,
      } as const;
    }

    // Solo candidatos pueden postular
    if ((s.user as any)?.role !== "CANDIDATE") {
      return { error: "ROLE", message: "Solo candidatos pueden postular" } as const;
    }

    // Ubicar candidateId por email de sesión
    const candidate = await prisma.user.findUnique({
      where: { email: s.user.email! },
      select: { id: true, name: true, email: true },
    });
    if (!candidate) {
      return { error: "UNKNOWN", message: "Usuario no encontrado" } as const;
    }

    // Evitar duplicados
    const existing = await prisma.application.findFirst({
      where: { jobId: params.id, candidateId: candidate.id },
      select: { id: true },
    });
    if (existing) {
      return { ok: true, redirect: "/profile/summary?applied=existing" } as const;
    }

    await prisma.application.create({
      data: {
        jobId: params.id,
        candidateId: candidate.id,
        status: "SUBMITTED",
      },
    });

    // 🔔 Email al candidato (async, no bloquea la respuesta)
    void sendApplicationSubmittedEmail({
      to: candidate.email!,
      candidateName: candidate.name || "",
      jobTitle: job.title,
      companyName: job.company?.name,
      applicationId: params.id,
    });

    return { ok: true, redirect: "/profile/summary?applied=1" } as const;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <p className="text-zinc-600">
          {job.company?.name ?? "—"} — {job.location}
        </p>
        <p className="text-sm text-zinc-500">
          {job.employmentType} · {job.seniority} ·{" "}
          {job.remote ? "Remoto" : "Presencial/Híbrido"}
        </p>
        <time
          className="block text-xs text-zinc-500"
          title={new Date(job.updatedAt).toLocaleString()}
        >
          Actualizada {fromNow(job.updatedAt)}
        </time>
      </header>

      <section className="prose prose-zinc max-w-none">
        <pre className="whitespace-pre-wrap font-sans text-[15px] leading-6">
          {job.description}
        </pre>
      </section>

      {job.skills?.length > 0 && (
        <section className="mt-2 flex flex-wrap gap-2">
          {job.skills.map((s) => (
            <span
              key={s}
              className="text-xs bg-gray-100 px-2 py-1 rounded border"
            >
              {s}
            </span>
          ))}
        </section>
      )}

      <footer className="pt-4">
        {isCandidate ? (
          <ApplyButton applyAction={applyAction} />
        ) : (
          <a
            href={`/signin?role=CANDIDATE&callbackUrl=/jobs/${job.id}`}
            className="border rounded-xl px-4 py-2 hover:bg-gray-50 inline-block"
          >
            Iniciar sesión como candidato para postular
          </a>
        )}
      </footer>
    </main>
  );
}

/* ===================== CLIENT ===================== */
"use client";

import { toastSuccess, toastError, toastInfo } from "@/lib/ui/toast";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

function ApplyButton({
  applyAction,
}: {
  applyAction: () => Promise<
    | { ok: true; redirect: string }
    | { error: "AUTH"; signinUrl: string }
    | { error: "ROLE"; message: string }
    | { error: "UNKNOWN"; message?: string }
  >;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await applyAction();

      if ("ok" in res && res.ok) {
        toastSuccess("Postulación enviada");
        router.push(res.redirect);
        return;
      }

      if (res.error === "AUTH") {
        toastInfo("Inicia sesión para postular");
        window.location.href = res.signinUrl;
        return;
      }
      if (res.error === "ROLE") {
        toastError(res.message || "No autorizado");
        return;
      }
      toastError(res.message || "No se pudo postular");
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="border rounded-xl px-4 py-2 disabled:opacity-60 hover:bg-gray-50"
    >
      {pending ? "Postulando..." : "Postularme"}
    </button>
  );
}
