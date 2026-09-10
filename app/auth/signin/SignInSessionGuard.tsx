"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSession, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { authenticatedSigninDestination } from "@/lib/auth/login";

export default function SignInSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setSessionChecked(false);
      router.replace(authenticatedSigninDestination(session.user.role));
      return;
    }

    if (status === "unauthenticated") {
      setSessionChecked(true);
    }
  }, [router, session, status]);

  useEffect(() => {
    let active = true;

    const handlePageHide = () => setSessionChecked(false);
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;

      setSessionChecked(false);
      void getSession().then((restoredSession) => {
        if (!active) return;

        if (restoredSession?.user) {
          router.replace(
            authenticatedSigninDestination(restoredSession.user.role)
          );
          return;
        }

        setSessionChecked(true);
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      active = false;
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return sessionChecked ? children : null;
}
