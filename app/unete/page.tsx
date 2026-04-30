// app/unete/page.tsx
import type { Metadata } from "next";

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

// ✅ Página real con HTML — LinkedIn puede leer los OG tags
// El redirect a /auth/signup/candidate ocurre via JS después de que LinkedIn scrapea
export default function UnetePage() {
  return (
    <>
      {/* Redirect JS — invisible para el usuario, transparente para scrapers */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace("/auth/signup/candidate");`,
        }}
      />
      {/* Fallback visible brevemente antes del redirect */}
      <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/logo-taskio-dark.svg"
            alt="TaskIO"
            className="h-12 mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">
          Únete a TaskIO
        </h1>
        <p className="mt-2 text-zinc-500">
          Bolsa de trabajo TI en México
        </p>
        <p className="mt-6 text-sm text-zinc-400">
          Redirigiendo...{" "}
          <a
            href="/auth/signup/candidate"
            className="text-emerald-600 underline"
          >
            Haz clic aquí si no eres redirigido
          </a>
        </p>
      </main>
    </>
  );
}