// app/profile/messages/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const metadata = { title: "Mis mensajes | Bolsa TI" };

export default async function MyMessagesPage({
  searchParams,
}: {
  searchParams: { applicationId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/profile/messages");

  const meEmail = session.user?.email!;
  const me = await prisma.user.findUnique({
    where: { email: meEmail },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!me) redirect("/");

  // Solo CANDIDATE
  if (me.role !== "CANDIDATE") redirect("/");

  const applicationId = searchParams.applicationId;

  // 1) Sin applicationId: lista de mis postulaciones para abrir chat
  if (!applicationId) {
    const myApps = await prisma.application.findMany({
      where: { candidateId: me.id },
      orderBy: { createdAt: "desc" },
      include: {
        job: { select: { title: true, company: true } },
      },
      take: 25,
    });

    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Mis mensajes</h1>
        <p className="text-sm text-zinc-600">Elige la postulación para abrir el chat.</p>
        {myApps.length === 0 ? (
          <p className="text-sm text-zinc-500">Aún no tienes postulaciones.</p>
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
                      Postulada{" "}
                      <time title={new Date(a.createdAt).toLocaleString()}>
                        {formatDistanceToNow(new Date(a.createdAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </time>
                    </div>
                  </div>
                  <a
                    href={`/profile/messages?applicationId=${a.id}`}
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

  // 2) Con applicationId: valida que la application sea del candidato
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { id: true, title: true, company: true, recruiterId: true } },
      candidate: { select: { id: true } },
    },
  });
  if (!app || app.candidateId !== me.id) redirect("/profile/messages");

  const recruiter = app.job?.recruiterId
    ? await prisma.user.findUnique({
        where: { id: app.job.recruiterId },
        select: { id: true, name: true, email: true },
      })
    : null;

  const messages = await prisma.message.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });

  // Server Action: enviar mensaje (candidato -> recruiter)
  async function sendMessageAction(formData: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user?.email) return { error: "No autenticado" };

    const sender = await prisma.user.findUnique({
      where: { email: s.user.email },
      select: { id: true, role: true },
    });
    if (!sender || sender.role !== "CANDIDATE") {
      return { error: "Sin permisos" };
    }

    // Verificación de ownership del hilo
    const appCheck = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { candidateId: true, job: { select: { recruiterId: true } } },
    });
    if (!appCheck || appCheck.candidateId !== sender.id || !appCheck.job?.recruiterId) {
      return { error: "No autorizado para este hilo" };
    }

    const body = String(formData.get("body") || "").trim();
    if (body.length < 2) return { error: "El mensaje es muy corto" };
    if (body.length > 2000) return { error: "El mensaje es demasiado largo (máx. 2000)" };

    await prisma.message.create({
      data: {
        applicationId,
        fromUserId: sender.id,
        toUserId: appCheck.job.recruiterId,
        body,
      },
    });

    revalidatePath(`/profile/messages?applicationId=${applicationId}`);
    return { ok: true };
  }

  const RecruiterLabel = recruiter?.name || recruiter?.email || "Reclutador";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis mensajes</h1>
        <p className="text-sm text-zinc-600">
          {app.job?.title} — {app.job?.company} · {RecruiterLabel}
        </p>
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
                  <div className="text-[10px] text-zinc-500 mt-1">
                    <time title={new Date(m.createdAt).toLocaleString()}>
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                    </time>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Formulario de envío con RHF + Zod + toasts */}
      <MessageFormClient recruiterLabel={RecruiterLabel} onAction={sendMessageAction} />
    </main>
  );
}

/* ==================== CLIENT ==================== */
"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const MessageSchema = z.object({
  body: z.string().min(2, "El mensaje es muy corto").max(2000, "Máximo 2000 caracteres"),
});
type MessageInput = z.infer<typeof MessageSchema>;

function MessageFormClient({
  recruiterLabel,
  onAction,
}: {
  recruiterLabel: string;
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
      toast.error(res.error);
      return;
    }
    toast.success("Mensaje enviado");
    reset({ body: "" });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
      <input
        {...register("body")}
        className="flex-1 border rounded-xl px-3 py-2"
        placeholder={`Mensaje para ${recruiterLabel}...`}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.currentTarget.form?.requestSubmit(); // Ctrl/Cmd + Enter = enviar
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
