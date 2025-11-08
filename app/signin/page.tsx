// app/signin/page.tsx
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LegacySignin({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(v)) v.forEach((x) => x != null && params.append(k, x));
    else if (v != null) params.set(k, v);
  }
  const qs = params.toString();
  redirect(`/auth/signin${qs ? `?${qs}` : ""}`);
}
