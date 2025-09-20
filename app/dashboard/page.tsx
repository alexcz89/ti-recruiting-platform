// app/dashboard/page.tsx
import { redirect } from "next/navigation"

export default function DashboardIndex() {
  // Redirige al overview para que no coincida con /dashboard/jobs
  redirect("/dashboard/overview")
}
