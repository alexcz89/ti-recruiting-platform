// app/unete/page.tsx
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Únete a TaskIO — Bolsa de trabajo TI en México",
  description:
    "Crea tu cuenta gratis en TaskIO y accede a las mejores vacantes de tecnología en México.",
  alternates: {
    canonical: "/unete",
  },
};

export default function UnetePage() {
  redirect("/auth/signup/candidate");
}