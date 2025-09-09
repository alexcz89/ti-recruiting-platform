// app/(recruiter)/dashboard/page.tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";  // 👈 importante
import Link from "next/link";

async function getData() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/applications`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar las postulaciones");
  return res.json();
}

export default async function Dashboard() {
  const session = await auth();
  const role = (session?.user as any)?.role;

  if (!session) {
    return <p className="p-6">Debes iniciar sesión para ver el panel.</p>;
  }
  if (role !== "RECRUITER") {
    return <p className="p-6">No tienes permisos para ver este panel.</p>;
  }

  const data = await getData();

  async function doSignOut() {
    "use server";
    await signOut();
    redirect("/");   // 👈 después de cerrar sesión manda al inicio
  }

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Panel del Reclutador</h2>
        <form action={doSignOut}>
          <button className="border rounded px-3 py-1">Cerrar sesión</button>
        </form>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-zinc-50">
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Vacante</th>
              <th className="p-2 border">Candidato</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Estatus</th>
              <th className="p-2 border">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.applications.map((a: any) => (
              <tr key={a.id}>
                <td className="p-2 border">{new Date(a.createdAt).toLocaleString()}</td>
                <td className="p-2 border">
                  <Link href={`/jobs/${a.jobId}`} className="underline">
                    {a.job?.title || a.jobId}
                  </Link>
                </td>
                <td className="p-2 border">{a.candidate?.name || "(Sin nombre)"}</td>
                <td className="p-2 border">{a.candidate?.email}</td>
                <td className="p-2 border">{a.status}</td>
                <td className="p-2 border">
                  <form action={`/api/applications/${a.id}/status`} method="post" className="flex gap-2">
                    <select name="status" defaultValue={a.status} className="border rounded px-2 py-1">
                      <option>SUBMITTED</option>
                      <option>REVIEWING</option>
                      <option>INTERVIEW</option>
                      <option>OFFER</option>
                      <option>REJECTED</option>
                    </select>
                    <button className="border rounded px-3 py-1">Actualizar</button>
                  </form>
                </td>
              </tr>
            ))}
            {data.applications.length === 0 && (
              <tr>
                <td className="p-3 text-zinc-500 text-center" colSpan={6}>
                  Sin postulaciones
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
