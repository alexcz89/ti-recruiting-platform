// app/dashboard/admin/users/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/server/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { UserActionsClient } from "./UserActionsClient";

export const metadata = { title: "Admin · Usuarios" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if ((session.user as any)?.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
    },
  });

  // Server Action — soft delete usuario
  async function deleteUserAction(fd: FormData) {
    "use server";
    const s = await getServerSession(authOptions);
    if (!s?.user || (s.user as any)?.role !== "ADMIN") return { error: "Sin permisos" };

    const userId = String(fd.get("userId") || "");
    if (!userId) return { error: "ID inválido" };

    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}@deleted.invalid`,
        name: "Usuario eliminado",
        passwordHash: null,
      },
    });

    revalidatePath("/dashboard/admin/users");
    return { ok: true };
  }

  const recruiters = users.filter(u => u.role === "RECRUITER");
  const candidates = users.filter(u => u.role === "CANDIDATE");
  const admins = users.filter(u => u.role === "ADMIN");

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 p-2.5 shadow-md">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-white">Usuarios</h1>
              <p className="text-sm text-zinc-500">{users.length} usuarios · {recruiters.length} recruiters · {candidates.length} candidatos</p>
            </div>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Admins", count: admins.length, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30" },
            { label: "Recruiters", count: recruiters.length, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Candidatos", count: candidates.length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`rounded-xl border border-zinc-200/80 ${bg} dark:border-zinc-800/50 p-4 text-center`}>
              <p className={`text-2xl font-black ${color}`}>{count}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white dark:border-zinc-800/50 dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase text-zinc-400">Registro</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {user.name || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        user.role === "ADMIN"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : user.role === "RECRUITER"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString("es-MX")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.role !== "ADMIN" && !user.email.includes("deleted") && (
                        <UserActionsClient
                          userId={user.id}
                          userName={user.name || user.email}
                          onDelete={deleteUserAction}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}