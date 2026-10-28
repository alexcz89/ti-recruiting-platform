"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/server/auth";

// Refreshes navigation via Next.js cache invalidation; never mutates an attempt.
export async function refreshAssessmentInbox() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "CANDIDATE") return;
  revalidatePath("/assessments");
}
