"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignIn() {
  const [email, setEmail] = useState("recruiter@example.com");
  const [password, setPassword] = useState("Recruiter123!");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Ingresando...");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setMsg("Credenciales inválidas");
      return;
    }

    // ✅ obtener rol desde API de sesión
    try {
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;

      if (role === "RECRUITER") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/jobs";
      }
    } catch (err) {
      setMsg("Sesión iniciada, pero no se pudo redirigir");
    }
  }

  return (
    <section className="py-8 max-w-md">
      <h2 className="text-2xl font-semibold mb-4">Ingresar</h2>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          name="email"
          placeholder="Email"
          className="border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="border rounded px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="border rounded px-4 py-2 w-fit">Entrar</button>
      </form>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </section>
  );
}
