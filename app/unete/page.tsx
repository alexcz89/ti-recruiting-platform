// app/unete/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "TaskIO — Bolsa de trabajo TI en México",
  description:
    "Crea tu cuenta gratis y accede a las mejores vacantes de tecnología en México. Sin tarjeta de crédito.",
  alternates: {
    canonical: "https://www.taskio.com.mx/unete",
  },
  openGraph: {
    title: "TaskIO — Bolsa de trabajo TI en México",
    description:
      "Crea tu cuenta gratis y accede a las mejores vacantes de tecnología en México. Sin tarjeta de crédito.",
    url: "https://www.taskio.com.mx/unete",
    siteName: "TaskIO",
    locale: "es_MX",
    type: "website",
    images: [
      {
        url: "https://www.taskio.com.mx/TASKIO.png",
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
    images: ["https://www.taskio.com.mx/TASKIO.png"],
  },
};

export default function UnetePage() {
  redirect("/auth/signup/candidate");
}