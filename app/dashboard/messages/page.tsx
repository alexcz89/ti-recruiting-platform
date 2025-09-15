// app/dashboard/messages/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

  // 1) Sin applicationId: muestra un selector de postulaciones del recruiter
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
      candidate: { select: { id: true, name: true, email: true, phone: true } }, // ← añadimos phone
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
    const body = String(formData.get("body") || "").trim();
    if (!body) return;

    await prisma.message.create({
      data: {
        applicationId,
        fromUserId: me.id,
        toUserId: app.candidateId,
        body,
      },
    });

    revalidatePath(`/dashboard/messages?applicationId=${applicationId}`);
  }

  const CandidateLabel = app.candidate?.name || app.candidate?.email || "Candidato";

  // --- WhatsApp link (usa E.164 guardado en user.phone) ---
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

        {/* Botón WhatsApp si existe teléfono */}
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
                  <div className="text-[10px] text-zinc-500 mt-1">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Enviar mensaje */}
      <form action={sendMessageAction} className="flex gap-2">
        <input
          name="body"
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder={`Mensaje para ${CandidateLabel}...`}
        />
        <button className="border rounded-xl px-4 py-2">Enviar</button>
      </form>
    </main>
  );
}
