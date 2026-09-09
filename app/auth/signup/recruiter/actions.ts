"use server";

import type { RecruiterSimpleSignupInput } from "@/lib/shared/validation/recruiter/simple";

export type ActionState = {
  ok: boolean;
  message?: string;
  warningDomain?: boolean;
};

/** Public recruiter provisioning is disabled during paid pilots. */
export async function createRecruiterAction(
  _input: RecruiterSimpleSignupInput
): Promise<ActionState> {
  return {
    ok: false,
    message: "El acceso para reclutadores se habilita manualmente para cada piloto.",
  };
}
