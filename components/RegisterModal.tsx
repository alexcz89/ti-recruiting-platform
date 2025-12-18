"use client";

import { Users, Briefcase, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function RegisterModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <div className="animate-fade-in animation-delay-500 mt-8 text-sm text-muted-foreground">
        <span>¿Primera vez? </span>
        <button
          onClick={() => setIsOpen(true)}
          className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 transition-colors underline decoration-dotted underline-offset-4"
        >
          Crear cuenta
        </button>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-foreground mb-2">
              ¿Cómo quieres registrarte?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Elige el tipo de cuenta según tu necesidad
            </p>

            <div className="space-y-3">
              <Link
                href="/auth/signup/candidate"
                className="flex items-center gap-3 rounded-lg border-2 border-border bg-background p-4 transition-all duration-200 hover:border-emerald-500/50 hover:bg-emerald-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                  <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground">
                    Soy candidato
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Busco trabajo en tech
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 rotate-[-90deg] text-muted-foreground" />
              </Link>

              <Link
                href="/auth/signup/recruiter"
                className="flex items-center gap-3 rounded-lg border-2 border-border bg-background p-4 transition-all duration-200 hover:border-violet-500/50 hover:bg-violet-500/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15">
                  <Briefcase className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground">
                    Soy reclutador
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Busco talento tech
                  </div>
                </div>
                <ChevronDown className="h-5 w-5 rotate-[-90deg] text-muted-foreground" />
              </Link>
            </div>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/auth/signin"
                className="font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                Inicia sesión
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}