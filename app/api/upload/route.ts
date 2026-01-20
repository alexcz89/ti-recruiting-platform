import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Only allow PDF/DOC/DOCX, with a basic size cap
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (typeof (file as any).size === "number" && (file as any).size > maxBytes) {
      return NextResponse.json(
        { error: "Archivo demasiado grande (max 5MB)" },
        { status: 413 }
      );
    }

    const name = file.name || "upload.bin";
    const ext = path.extname(name).toLowerCase();
    const allowedExt = [".pdf", ".doc", ".docx"];
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedExt.includes(ext) || !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de archivo no permitido" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const safeName = name.replace(/[^\w.\-]/g, "_");
    const filename = `${Date.now()}_${safeName}`;
    const filepath = path.join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("[POST /api/upload] error", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
