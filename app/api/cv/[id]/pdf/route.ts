import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import puppeteer from "puppeteer";

export const dynamic = "force-dynamic";

function htmlWrapper(inner: string) {
  // Envolvemos el snapshot con estilos mínimos de impresión
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CV</title>
<style>
 @page { size: A4; margin: 16mm; }
 body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111; }
 h1,h2 { margin: 0; }
 .wrapper { width: 800px; max-width: 100%; margin: 0 auto; }
</style>
</head>
<body>
<div class="wrapper">
${inner}
</div>
</body>
</html>`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resume = await prisma.resume.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, htmlSnapshot: true, title: true },
  });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const me = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!me || me.id !== resume.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const html = htmlWrapper(resume.htmlSnapshot);

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      printBackground: true,
      format: "A4",
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
    await browser.close();

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(resume.title || "CV")}.pdf"`,
      },
    });
  } catch (e) {
    try { await browser.close(); } catch {}
    return NextResponse.json({ error: "PDF error", detail: String(e) }, { status: 500 });
  }
}
