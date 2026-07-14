import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { authOptions } from "@/lib/server/auth";
import { prisma } from "@/lib/server/prisma";
import { checkActionRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);

function jsonNoStore(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return jsonNoStore({ error: "No autenticado" }, 401);
    }
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });
    if (!me || me.role !== "CANDIDATE") {
      return jsonNoStore({ error: "No autorizado" }, 403);
    }

    const rateLimit = checkActionRateLimit("cv-upload", me.id, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return jsonNoStore(
        { error: "Demasiadas cargas. Intenta nuevamente más tarde." },
        429,
        { "Retry-After": String(rateLimit.retryAfter ?? 60) }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonNoStore({ error: "Archivo no recibido" }, 400);
    }

    const fileName = file.name.toLowerCase();
    const acceptedExtension = ACCEPTED_EXTENSIONS.some((extension) =>
      fileName.endsWith(extension)
    );
    if (
      !acceptedExtension ||
      (file.type && !ACCEPTED_MIME_TYPES.has(file.type))
    ) {
      return jsonNoStore({ error: "Solo se permiten PDF, DOC o DOCX." }, 400);
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return jsonNoStore({ error: "El archivo debe pesar menos de 8 MB." }, 400);
    }

    const uploadResult = await new UTApi().uploadFiles(file);
    const url = uploadResult?.data?.ufsUrl ?? uploadResult?.data?.url;
    if (!url || uploadResult.error) {
      console.error("UploadThing resume upload error:", uploadResult?.error);
      return jsonNoStore({ error: "Fallo al subir archivo" }, 500);
    }

    return jsonNoStore({ url });
  } catch (error) {
    console.error("Resume upload error:", error);
    return jsonNoStore({ error: "Error interno" }, 500);
  }
}
