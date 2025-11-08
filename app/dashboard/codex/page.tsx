// app/dashboard/codex/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import RowActions from "./RowActions";

export const metadata = {
  title: "Codex (Admin) | Bolsa TI",
};

export default async function CodexAdminPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session) redirect(`/signin?callbackUrl=/dashboard/codex`);
  if (role !== "RECRUITER" && role !== "ADMIN") redirect("/");

  const entries = await prisma.codexEntry.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      tech: true,
      tags: true,
      published: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Server Action: eliminar por slug
  async function deleteAction(formData: FormData) {
    "use server";
    const slug = String(formData.get("slug") || "");
    if (!slug) return;
    await prisma.codexEntry.delete({ where: { slug } });
  }

  // Server Action: toggle published
  async function togglePublishedAction(formData: FormData) {
    "use server";
    const slug = String(formData.get("slug") || "");
    const current = String(formData.get("published") || "true") === "true";
    if (!slug) return;
    await prisma.codexEntry.update({
      where: { slug },
      data: { published: !current },
    });
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Codex — Admin</h1>
        <Link
          href="/dashboard/codex/new"
          className="border rounded-xl px-4 py-2 hover:bg-gray-50"
        >
          Nuevo artículo
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">Aún no hay artículos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-sm text-zinc-600">
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Tech</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 whitespace-nowrap">Actualizado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="glass-card p-4 md:p-6">
                  <td className="px-3 py-3">
                    <div className="font-medium">{e.title}</div>
                    <Link
                      href={`/codex/${e.slug}`}
                      className="text-xs text-blue-600 hover:underline"
                      target="_blank"
                    >
                      Ver público
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-sm text-zinc-600">{e.slug}</td>
                  <td className="px-3 py-3 text-sm">{e.tech ?? "-"}</td>
                  <td className="px-3 py-3 text-xs text-zinc-600">
                    {e.tags?.length ? e.tags.join(", ") : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        e.published ? "bg-green-100 text-green-700" : "glass-card p-4 md:p-6"
                      }`}
                    >
                      {e.published ? "Publicado" : "Borrador"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600">
                    {new Date(e.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <RowActions
                      slug={e.slug}
                      published={e.published}
                      onDelete={deleteAction}
                      onTogglePublished={togglePublishedAction}
                      editHref={`/dashboard/codex/${e.slug}/edit`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
