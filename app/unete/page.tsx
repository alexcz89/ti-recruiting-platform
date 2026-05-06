// app/unete/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

const APP_URL = "https://www.taskio.com.mx";

export const metadata: Metadata = {
  title: "TaskIO — Bolsa de trabajo TI en México",
  description:
    "Crea tu cuenta gratis y accede a las mejores vacantes de tecnología en México. Sin tarjeta de crédito.",
  alternates: {
    canonical: `${APP_URL}/unete`,
  },
  openGraph: {
    title: "TaskIO — Bolsa de trabajo TI en México",
    description:
      "Crea tu cuenta gratis y accede a las mejores vacantes de tecnología en México. Sin tarjeta de crédito.",
    url: `${APP_URL}/unete`,
    siteName: "TaskIO",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: `${APP_URL}/TASKIO.png`,
        width: 400,
        height: 400,
        alt: "TaskIO — Bolsa de trabajo TI en México",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "TaskIO — Bolsa de trabajo TI en México",
    description:
      "Crea tu cuenta gratis y accede a las mejores vacantes de tecnología en México.",
    images: [`${APP_URL}/TASKIO.png`],
  },
};

export default function UnetePage() {
  // ✅ Redirect server-side — instantáneo, sin flash, sin depender de JS
  // Los OG tags de metadata arriba siguen siendo leídos por scrapers (LinkedIn, etc.)
  // porque Next.js inyecta los meta tags en el HTML antes del redirect
  redirect("/auth/signup/candidate");
}