// app/auth/signup/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCircle, Building2, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9h10M9 4v10" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              TASK<span className="text-violet-600 dark:text-violet-400">IO</span>
            </span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 tracking-tight">
            Únete a TaskIO
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Selecciona el tipo de cuenta que deseas crear
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <RoleCard
            icon={<UserCircle className="h-6 w-6" />}
            tag="Busco trabajo"
            title="Soy Candidato"
            description="Accede a oportunidades de trabajo en tecnología y conecta con las mejores empresas."
            features={[
              "Crea tu CV profesional en minutos",
              "Postula a vacantes con un clic",
              "Realiza evaluaciones técnicas",
              "Recibe ofertas directas de empresas",
            ]}
            buttonText="Crear cuenta como candidato"
            buttonColor="emerald"
            onClick={() => router.push("/auth/signup/candidate")}
          />

          <RoleCard
            icon={<Building2 className="h-6 w-6" />}
            tag="Busco talento"
            title="Soy Reclutador"
            description="Encuentra y contrata profesionales tech con el pipeline más eficiente del mercado."
            features={[
              "Publica vacantes ilimitadas",
              "Accede a CVs verificados",
              "Gestiona evaluaciones técnicas",
              "Pipeline completo de candidatos",
            ]}
            buttonText="Crear cuenta como reclutador"
            buttonColor="violet"
            onClick={() => router.push("/auth/signup/recruiter")}
          />
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/auth/signin"
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold transition-colors"
            >
              Inicia sesión
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}

/* -------- Role Card Component -------- */
interface RoleCardProps {
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonColor: "emerald" | "violet";
  onClick: () => void;
}

function RoleCard({
  icon,
  tag,
  title,
  description,
  features,
  buttonText,
  buttonColor,
  onClick,
}: RoleCardProps) {
  const colors = {
    emerald: {
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconText: "text-emerald-600 dark:text-emerald-400",
      button: "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white",
      border: "hover:border-emerald-300 dark:hover:border-emerald-700",
      tag: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900",
      check: "text-emerald-500 dark:text-emerald-400",
      glow: "bg-emerald-500",
    },
    violet: {
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconText: "text-violet-600 dark:text-violet-400",
      button: "bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white",
      border: "hover:border-violet-300 dark:hover:border-violet-700",
      tag: "bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400 border border-violet-100 dark:border-violet-900",
      check: "text-violet-500 dark:text-violet-400",
      glow: "bg-violet-500",
    },
  }[buttonColor];

  return (
    <div
      className={`
        group relative rounded-2xl border p-6 cursor-pointer
        bg-white dark:bg-zinc-900
        border-zinc-200 dark:border-zinc-800
        transition-all duration-200
        hover:shadow-xl hover:-translate-y-1
        ${colors.border}
      `}
      onClick={onClick}
    >
      {/* Tag + Icon row */}
      <div className="flex items-center justify-between mb-5">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${colors.tag}`}>
          {tag}
        </span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${colors.iconBg} ${colors.iconText}`}>
          {icon}
        </div>
      </div>

      {/* Text */}
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-1.5 tracking-tight">
        {title}
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
        {description}
      </p>

      {/* Divider */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 mb-5" />

      {/* Features */}
      <ul className="space-y-2.5 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${colors.check}`} />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 ${colors.button}`}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        {buttonText} →
      </button>

      {/* Subtle glow on hover */}
      <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none ${colors.glow}`} />
    </div>
  );
}