// app/profile/messages/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
  if (!applicationId) {
    const myApps = await prisma.application.findMany({
      where: { candidateId: me.id },
      orderBy: { createdAt: "desc" },
      include: { job: { select: { title: true, company: true } } },
      take: 25,
    });

    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Mis mensajes</h1>
        <p className="text-sm text-zinc-600">Elige la postulación para abrir el chat.</p>
        <ul className="space-y-2">
          {myApps.map(a => (
            <li key={a.id} className="border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.job?.title} — {a.job?.company}</div>
                  <div className="text-xs text-zinc-500">
                    Postulada el {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <a href={`/profile/messages?applicationId=${a.id}`} className="text-blue-600 hover:underline text-sm">
                  Abrir
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // Valida que la Application sea de este candidato
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { id: true, title: true, company: true, recruiterId: true } },
      candidate: { select: { id: true } },
    },
  });
  if (!app || app.candidateId !== me.id) redirect("/profile/messages");

  const recruiter = app.job?.recruiterId
    ? await prisma.user.findUnique({ where: { id: app.job.recruiterId }, select: { id: true, name: true, email: true } })
    : null;

  const messages = await prisma.message.findMany({
    where: { applicationId },
    orderBy: { createdAt: "asc" },
  });

  async function sendMessageAction(formData: FormData) {
    "use server";
    const body = String(formData.get("body") || "").trim();
    if (!body || !recruiter?.id) return;

    await prisma.message.create({
      data: {
        applicationId,
        fromUserId: me.id,
        toUserId: recruiter.id,
        body,
      },
    });

    revalidatePath(`/profile/messages?applicationId=${applicationId}`);
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

      <div className="border rounded-xl p-4 space-y-3 bg-white">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay mensajes todavía.</p>
        ) : (
          messages.map(m => {
            const mine = m.fromUserId === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`rounded-xl px-3 py-2 text-sm ${mine ? "bg-blue-50" : "bg-gray-100"}`}>
                  <div>{m.body}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{new Date(m.createdAt).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form action={sendMessageAction} className="flex gap-2">
        <input name="body" className="flex-1 border rounded-xl px-3 py-2" placeholder={`Mensaje para ${RecruiterLabel}...`} />
        <button className="border rounded-xl px-4 py-2">Enviar</button>
      </form>
    </main>
  );
}
