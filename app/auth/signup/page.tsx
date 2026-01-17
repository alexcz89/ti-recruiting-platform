// app/auth/signup/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCircle, Building2 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-3">
            Únete a TaskIT
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Selecciona el tipo de cuenta que deseas crear
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Tarjeta Candidato */}
          <RoleCard
            icon={<UserCircle className="h-12 w-12" />}
            title="Busco trabajo"
            subtitle="Soy Candidato"
            description="Accede a oportunidades de trabajo en tecnología"
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

          {/* Tarjeta Reclutador */}
          <RoleCard
            icon={<Building2 className="h-12 w-12" />}
            title="Busco talento"
            subtitle="Soy Reclutador / Empresa"
            description="Encuentra y contrata profesionales tech"
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/auth/signin"
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 font-medium transition-colors"
            >
              Iniciar sesión
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
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonColor: "emerald" | "violet";
  onClick: () => void;
}

function RoleCard({
  icon,
  title,
  subtitle,
  description,
  features,
  buttonText,
  buttonColor,
  onClick,
}: RoleCardProps) {
  const colorClasses = {
    emerald: {
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconText: "text-emerald-600 dark:text-emerald-400",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
      border: "hover:border-emerald-300 dark:hover:border-emerald-700",
      checkmark: "text-emerald-600 dark:text-emerald-500",
    },
    violet: {
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconText: "text-violet-600 dark:text-violet-400",
      button: "bg-violet-600 hover:bg-violet-700 text-white",
      border: "hover:border-violet-300 dark:hover:border-violet-700",
      checkmark: "text-violet-600 dark:text-violet-500",
    },
  };

  const colors = colorClasses[buttonColor];

  return (
    <div
      className={`
        group relative rounded-2xl border-2 p-6 md:p-8
        transition-all duration-200 cursor-pointer
        border-zinc-200 dark:border-zinc-800
        bg-white dark:bg-zinc-900
        hover:shadow-xl hover:-translate-y-1
        ${colors.border}
      `}
      onClick={onClick}
    >
      {/* Icon & Title */}
      <div className="text-center mb-6">
        <div
          className={`
          inline-flex items-center justify-center
          w-20 h-20 rounded-2xl mb-4
          transition-transform group-hover:scale-110
          ${colors.iconBg} ${colors.iconText}
        `}
        >
          {icon}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
            {title}
          </p>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {subtitle}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>

      {/* Features List */}
      <ul className="space-y-3 mb-6">
        {features.map((feature, index) => (
          <li
            key={index}
            className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <svg
              className={`h-5 w-5 shrink-0 mt-0.5 ${colors.checkmark}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        className={`
          w-full h-11 rounded-lg
          text-sm font-semibold
          transition-all duration-200
          ${colors.button}
          group-hover:shadow-lg
        `}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {buttonText}
      </button>

      {/* Decorative gradient (optional) */}
      <div
        className={`
        absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-5
        transition-opacity pointer-events-none
        ${buttonColor === "emerald" ? "bg-emerald-600" : "bg-violet-600"}
      `}
      />
    </div>
  );
}