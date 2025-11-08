// app/api/profile/upload-resume/route.ts
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

export const runtime = "nodejs"; // asegúrate que no sea edge para poder usar buffers

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });
    }

    // Subir con UTApi (usa UPLOADTHING_TOKEN/SECRET en el servidor)
    const utapi = new UTApi();
    const res = await utapi.uploadFiles(file);
    if (!res?.data?.url) {
      return NextResponse.json({ error: "Fallo al subir archivo" }, { status: 500 });
    }

    return NextResponse.json({ url: res.data.url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
