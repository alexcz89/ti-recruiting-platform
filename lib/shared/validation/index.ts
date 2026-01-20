// lib/shared/validation/index.ts

// Candidate
export { CandidateSignInSchema as SignInSchema } from "./candidate/signin";
export { CandidateSignInSchema } from "./candidate/signin";
export {
  CandidateSignupSchema,
  CandidateRegisterSchema,
} from "./candidate/signup";

// Recruiter (FULL)
export { recruiterSignInSchema } from "./recruiter/signin";
export { recruiterSignupSchema, FREE_DOMAINS } from "./recruiter/signup";

// Recruiter (SIMPLE) — signup corto de 6 campos
export {
  RecruiterSimpleSignupSchema,
  type RecruiterSimpleSignupInput,
} from "./recruiter/simple";

// Password Reset
export {
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyResetTokenSchema,
  type RequestPasswordResetInput,
  type ResetPasswordInput,
  type VerifyResetTokenInput,
} from "./password-reset";