// app/(candidate)/profile/page.tsx
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function CandidateProfile() {
  const session = await auth();
  const user = session?.user as any | undefined;
  const role = user?.role;

  if (!session) return <p className="p-6">Debes iniciar sesión.</p>;
  if (role !== "CANDIDATE")
    return <p className="p-6">Esta página es solo para candidatos.</p>;

  async function doSignOut() {
    "use server";
    await signOut();
    redirect("/"); // salir y mandar al inicio
  }

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Mi perfil</h2>
        <form action={doSignOut}>
          <button className="border rounded px-3 py-1">Cerrar sesión</button>
        </form>
      </div>

      <div className="grid gap-3 max-w-lg">
        <div className="border rounded p-4">
          <p><b>Email:</b> {user?.email}</p>
          <p><b>Nombre:</b> {user?.name || "(sin nombre)"}</p>
          <p><b>Rol:</b> {role}</p>
        </div>

        {/* Aquí luego añadimos CV, skills, historial de postulaciones, etc. */}
      </div>
    </section>
  );
}
