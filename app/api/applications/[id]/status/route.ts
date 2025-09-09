// app/api/applications/[id]/status/route.ts
import { NextRequest } from "next/server";
import { prisma } from "lib/prisma";

async function updateStatus(id: string, status: string) {
  const valid = ["SUBMITTED", "REVIEWING", "INTERVIEW", "OFFER", "REJECTED"];
  if (!valid.includes(status)) {
    return new Response(JSON.stringify({ error: "Status inválido" }), { status: 400 });
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status },
    include: { job: true, candidate: true },
  });

  return Response.json({ ok: true, application: updated });
}

// PATCH con JSON {status}
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const { status } = await req.json();
  return updateStatus(id, status);
}

// POST desde formulario <form method="post">
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const ctype = req.headers.get("content-type") || "";

  let status = "";
  if (ctype.includes("application/json")) {
    const body = await req.json();
    status = body.status || "";
  } else {
    const form = await req.formData();
    status = String(form.get("status") || "");
  }

  return updateStatus(id, status);
}
