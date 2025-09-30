// app/dashboard/messages/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { fromNow } from "@/lib/dates"; // ⬅️ helper para "hace X"
import { sendNewMessageEmail } from "@/lib/mailer"; // ⬅️ notificación por nuevo mensaje

export const metadata = { title: "Mensajes | Panel" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { applicationId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/dashboard/messages");

  const meEmail = session.user?.email!;
  const me = await prisma.user.findUnique({
    where: { email: meEmail },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!me) redirect("/");

  // Solo RECRUITER o ADMIN
  if (me.role !== "RECRUITER" && me.role !== "ADMIN") redirect("/");

  const applicationId = searchParams.applicationId;

  // 1) Sin applicationId: lista de postulaciones del recruiter
  if (!applicationId) {
    const myApps = await prisma.application.findMany({
      where: { job: { recruiterId: me.id } },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { title: true, company: true } },
        candidate: { select: { name: true, email: true } },
      },
      take: 50,
    });

    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Mensajes</h1>
        <p className="text-sm text-zinc-600">Selecciona una postulación para abrir el hilo.</p>
        {myApps.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay postulaciones de tus vacantes.</p>
        ) : (
          <ul className="space-y-2">
            {myApps.map((a) => (
              <li key={a.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {a.job?.title} — {a.job?.company}
                    </div>
                    <div className="text-xs text-zinc-500">
                      Candidato: {a.candidate?.name ?? a.candidate?.email}
                    </div>
                  </div>
                  <a
                    href={`/dashboard/messages?applicationId=${a.id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Abrir
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  // 2) Con applicationId: valida que la postulación sea de un job del recruiter
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { id: true, title: true, company: true, recruiterId: true } },
      candidate: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!app || app.job?.recruiterId !== me.id) {
    redirect("/dashboard/messages");
  }

  const messages = await prisma.message.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });

  // Server Action: enviar mensaje (recruiter -> candidato)
  async function sendMessageAction(formData: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user?.email) return { error: "No autenticado" };

    const sender = await prisma.user.findUnique({
      where: { email: s.user.email },
      select: { id: true, role: true, name: true, email: true },
    });
    if (!sender || (sender.role !== "RECRUITER" && sender.role !== "ADMIN")) {
      return { error: "Sin permisos" };
    }

    const body = String(formData.get("body") || "").trim();
    if (!body || body.length < 2) {
      return { error: "El mensaje es muy corto" };
    }
    if (body.length > 2000) {
      return { error: "El mensaje es demasiado largo (máx. 2000)" };
    }

    // seguridad: la aplicación debe pertenecer al recruiter + datos para email
    const appCheck = await prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        candidateId: true,
        candidate: { select: { email: true, name: true } },
        job: { select: { recruiterId: true, title: true } },
      },
    });
    if (!appCheck || appCheck.job?.recruiterId !== sender.id) {
      return { error: "No autorizado para este hilo" };
    }

    await prisma.message.create({
      data: {
        applicationId,
        fromUserId: sender.id,
        toUserId: appCheck.candidateId,
        body,
      },
    });

    // 🔔 Email al candidato con el nuevo mensaje (no bloquea)
    if (appCheck.candidate?.email) {
      void sendNewMessageEmail({
        to: appCheck.candidate.email,
        recipientName: appCheck.candidate.name || "",
        fromName: sender.name || sender.email!,
        jobTitle: appCheck.job?.title || "",
        applicationId,
        preview: body,
        isRecruiterRecipient: false, // el destinatario es el candidato
      });
    }

    revalidatePath(`/dashboard/messages?applicationId=${applicationId}`);
    return { ok: true };
  }

  const CandidateLabel = app.candidate?.name || app.candidate?.email || "Candidato";

  // WhatsApp link (usa E.164 guardado en user.phone)
  const waPhone = app.candidate?.phone ? app.candidate.phone.replace("+", "") : null;
  const waText = encodeURIComponent(
    `Hola ${app.candidate?.name ?? ""}, te contacto por la vacante "${app.job?.title}" de ${app.job?.company}.`
  );
  const waHref = waPhone ? `https://wa.me/${waPhone}?text=${waText}` : null;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mensajes</h1>
          <p className="text-sm text-zinc-600">
            {app.job?.title} — {app.job?.company} · {CandidateLabel}
          </p>
        </div>

        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="text-sm border rounded-xl px-3 py-2"
            title={`Abrir WhatsApp con ${app.candidate?.phone}`}
          >
            WhatsApp
          </a>
        ) : (
          <span className="text-xs text-zinc-400">Sin teléfono del candidato</span>
        )}
      </div>

      {/* Hilo */}
      <div className="border rounded-xl p-4 space-y-3 bg-white">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay mensajes todavía.</p>
        ) : (
          messages.map((m) => {
            const mine = m.fromUserId === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-xl px-3 py-2 text-sm ${mine ? "bg-blue-50" : "bg-gray-100"}`}>
                  <div>{m.body}</div>
                  <div className="text-[10px] text-zinc-500 mt-1" title={new Date(m.createdAt).toLocaleString()}>
                    {fromNow(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Formulario de envío con RHF + Zod + toasts */}
      <MessageFormClient candidateLabel={CandidateLabel} onAction={sendMessageAction} />
    </main>
  );
}

/* ==================== CLIENT ==================== */
"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toastSuccess, toastError } from "@/lib/ui/toast";

const MessageSchema = z.object({
  body: z
    .string()
    .min(2, "El mensaje es muy corto")
    .max(2000, "Máximo 2000 caracteres"),
});
type MessageInput = z.infer<typeof MessageSchema>;

function MessageFormClient({
  candidateLabel,
  onAction,
}: {
  candidateLabel: string;
  onAction: (fd: FormData) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MessageInput>({
    resolver: zodResolver(MessageSchema),
    defaultValues: { body: "" },
  });

  const onSubmit = async (data: MessageInput) => {
    const fd = new FormData();
    fd.set("body", data.body);
    const res = await onAction(fd);

    if (res?.error) {
      setError("body", { type: "server", message: res.error });
      toastError(res.error);
      return;
    }

    toastSuccess("Mensaje enviado");
    reset({ body: "" });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <input
        {...register("body")}
        className="flex-1 border rounded-xl px-3 py-2"
        placeholder={`Mensaje para ${candidateLabel}...`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            // Ctrl/Cmd + Enter = enviar
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="border rounded-xl px-4 py-2 disabled:opacity-60"
      >
        {isSubmitting ? "Enviando..." : "Enviar"}
      </button>
      {errors.body && (
        <p className="ml-2 self-center text-xs text-red-600">{errors.body.message}</p>
      )}
    </form>
  );
}
