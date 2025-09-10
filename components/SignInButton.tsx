"use client";
import { useRouter } from "next/navigation";

export default function SignInButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/signin")}
      className="border rounded px-3 py-1"
    >
      Ingresar
    </button>
  );
}
