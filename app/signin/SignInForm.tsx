// app/signin/SignInForm.tsx
"use client"

import { useState, useMemo, FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"

// Activa a true solo si configuraste estos providers en lib/auth.ts
const OAUTH_GOOGLE_ENABLED = false
const OAUTH_GITHUB_ENABLED = false

type RoleOpt = "RECRUITER" | "CANDIDATE"

export default function SignInForm({
  initialRole,
  isSignup,
}: {
  initialRole?: RoleOpt
  isSignup?: boolean
}) {
  const sp = useSearchParams()

  // Precedencia: prop -> query -> "CANDIDATE"
  const roleFromQuery = (sp.get("role") as RoleOpt) || undefined
  const role: RoleOpt = initialRole || roleFromQuery || "CANDIDATE"

  // isSignup: prop tiene prioridad, si no, lee ?signup=1
  const signupFlag = typeof isSignup === "boolean" ? isSignup : sp.get("signup") === "1"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)

  // callbackUrl: query si viene; si no, por rol
  const callbackUrl =
    sp.get("callbackUrl") ||
    (role === "RECRUITER" ? "/dashboard/overview" : "/jobs")

  const errorCode = sp.get("error")

  const errorMessage = useMemo(() => {
    if (inlineError) return inlineError
    switch (errorCode) {
      case "OAuthSignin":
      case "OAuthCallback":
      case "OAuthCreateAccount":
      case "OAuthAccountNotLinked":
        return "No pudimos vincular tu cuenta OAuth. Usa el mismo proveedor con el que te registraste."
      case "EmailCreateAccount":
      case "EmailSignin":
        return "No se pudo iniciar sesión con email."
      case "CredentialsSignin":
        return "Credenciales inválidas o el rol no coincide con tu cuenta."
      case "SessionRequired":
        return "Necesitas iniciar sesión para continuar."
      case "AccessDenied":
        return "Acceso denegado. No tienes permisos suficientes."
      case "Configuration":
        return "Error de configuración del login."
      case "Verification":
        return "El enlace de verificación es inválido o expiró."
      default:
        return errorCode ? "Ocurrió un error al iniciar sesión." : null
    }
  }, [errorCode, inlineError])

  async function handleCredentials(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setInlineError(null)

    const res = await signIn("credentials", {
      email,
      password,
      role,                        // ← enviamos rol elegido
      signup: signupFlag ? "1" : undefined,
      redirect: false,            // controlamos navegación
      callbackUrl,
    })

    setLoading(false)

    if (!res) {
      setInlineError("No se pudo contactar el servidor de autenticación.")
      return
    }
    if (res.error) {
      setInlineError(
        res.error === "CredentialsSignin"
          ? "Credenciales inválidas o rol incorrecto."
          : res.error
      )
      return
    }

    // éxito
    window.location.href = res.url ?? callbackUrl
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">
        {signupFlag ? "Crear cuenta" : "Iniciar sesión"}
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        {role === "RECRUITER" ? "Acceso para reclutadores." : "Acceso para talento."}
      </p>

      {!!errorMessage && (
        <div className="mb-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* OAuth */}
      <div className="space-y-3 mb-8">
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full border rounded-xl px-4 py-2 disabled:opacity-50"
          disabled={!OAUTH_GOOGLE_ENABLED}
          title={OAUTH_GOOGLE_ENABLED ? "Continuar con Google" : "Google OAuth no configurado"}
        >
          Continuar con Google
        </button>
        <button
          onClick={() => signIn("github", { callbackUrl })}
          className="w-full border rounded-xl px-4 py-2 disabled:opacity-50"
          disabled={!OAUTH_GITHUB_ENABLED}
          title={OAUTH_GITHUB_ENABLED ? "Continuar con GitHub" : "GitHub OAuth no configurado"}
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
            placeholder={role === "RECRUITER" ? "recruiter@demo.local" : "candidate@demo.local"}
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
            placeholder="demo"
            required
          />
        </div>

        {/* rol oculto por si quisieras leerlo del form (depuración) */}
        <input type="hidden" name="role" value={role} />

        <button
          type="submit"
          className="w-full border rounded-xl px-4 py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Procesando..." : signupFlag ? "Crear cuenta" : "Ingresar"}
        </button>
      </form>

      {/* Tips demo */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>Recruiter demo: <code>recruiter@demo.local</code> / <code>demo</code></p>
        <p>Admin demo: <code>admin@demo.local</code> / <code>demo</code></p>
      </div>
    </main>
  )
}
