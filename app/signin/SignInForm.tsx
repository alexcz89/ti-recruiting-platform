// app/signin/SignInForm.tsx
"use client";

import { useState, FormEvent, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Lee ?error=... de la URL
  const errorCode = searchParams.get("error");

  // Traduce códigos de NextAuth a mensajes para el usuario
  const errorMessage = useMemo(() => {
    switch (errorCode) {
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthCreateAccount":
      case "OAuthAccountNotLinked":
        return "No pudimos vincular tu cuenta OAuth. Intenta con el mismo proveedor que registraste o contacta soporte.";
      case "EmailCreateAccount":
      case "EmailSignin":
        return "No se pudo iniciar sesión con email. Revisa tu correo o vuelve a intentarlo.";
      case "CredentialsSignin":
        return "Credenciales inválidas. Verifica tu email y contraseña.";
      case "SessionRequired":
        return "Necesitas iniciar sesión para continuar.";
      case "AccessDenied":
        return "Acceso denegado. No tienes permisos suficientes.";
      case "Configuration":
        return "Error de configuración del login. Contacta al administrador.";
      case "Verification":
        return "El enlace de verificación es inválido o expiró.";
      default:
        return errorCode ? "Ocurrió un error al iniciar sesión." : null;
    }
  }, [errorCode]);

  async function handleCredentials(e: FormEvent) {
    e.preventDefault();
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl,
    });
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Iniciar sesión</h1>

      {/* Banner de error */}
      {!!errorMessage && (
        <div className="mb-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Debug solo en dev */}
      {process.env.NODE_ENV !== "production" && errorCode && (
        <p className="mb-6 text-xs text-zinc-400">debug: error={errorCode}</p>
      )}

      {/* OAuth */}
      <div className="space-y-3 mb-8">
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full border rounded-xl px-4 py-2"
        >
          Continuar con Google
        </button>
        <button
          onClick={() => signIn("github", { callbackUrl })}
          className="w-full border rounded-xl px-4 py-2"
        >
          Continuar con GitHub
        </button>
      </div>

      <div className="relative my-6 text-center">
        <span className="px-3 text-sm text-zinc-500 bg-white relative z-10">
          o con tu correo
        </span>
        <div className="absolute left-0 right-0 top-1/2 -z-0 border-t" />
      </div>

      {/* Credenciales */}
      <form onSubmit={handleCredentials} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm">Email</label>
          <input
            type="email"
            className="w-full border rounded-xl px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm">Password</label>
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button type="submit" className="w-full border rounded-xl px-4 py-2">
          Ingresar
        </button>
      </form>
    </main>
  );
}
