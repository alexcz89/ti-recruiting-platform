// app/auth/signup/candidate/page.tsx
import { Suspense } from "react";
import CandidateSignupClient from "./CandidateSignupClient";

export const metadata = {
  title: "Registro de Candidato | Bolsa TI",
};

// ⚠️ Evita problemas de prerender con useSearchParams en el client
export const dynamic = "force-dynamic";

export default function CandidateSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto mt-16 max-w-md rounded-2xl border glass-card p-4 md:p-6">
          <p className="text-center text-sm text-zinc-500">
            Cargando formulario de registro...
          </p>
        </div>
      }
    >
      <CandidateSignupClient />
    </Suspense>
  );
}
