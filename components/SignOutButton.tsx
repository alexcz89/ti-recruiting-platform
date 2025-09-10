// components/SignOutButton.tsx
"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="border rounded px-3 py-1"
    >
      Cerrar sesión
    </button>
  );
}
