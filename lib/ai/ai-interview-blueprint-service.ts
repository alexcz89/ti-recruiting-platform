import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { InterviewBlueprintSchema, type InterviewBlueprint } from "./ai-interview-blueprint-contract";

const Id = z.string().min(1).max(200).refine(value => value.trim() === value);
const Scope = z.object({ actorId: Id, companyId: Id, jobId: Id }).strict();
export type BlueprintScope = z.infer<typeof Scope>;
const RecordSchema = z.object({
  id: Id, companyId: Id, jobId: Id, createdById: Id,
  blueprint: InterviewBlueprintSchema,
  status: z.enum(["DRAFT", "APPROVED", "REVOKED"]),
  approvedById: Id.nullable(), approvedAt: z.date().nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(), createdAt: z.date(),
}).strict();
export type BlueprintVersion = z.infer<typeof RecordSchema>;
export type StoredBlueprintVersion = Omit<BlueprintVersion, "blueprint"> & { blueprint: unknown };
export interface BlueprintTransaction {
  authorize(scope: BlueprintScope): Promise<boolean>;
  find(scope: BlueprintScope, id: string, lock: boolean): Promise<StoredBlueprintVersion | null>;
  insert(scope: BlueprintScope, blueprint: InterviewBlueprint): Promise<StoredBlueprintVersion>;
  approve(scope: BlueprintScope, id: string, fingerprint: string): Promise<StoredBlueprintVersion | null>;
  revoke(scope: BlueprintScope, id: string): Promise<StoredBlueprintVersion | null>;
}
export interface BlueprintStore {
  transaction<T>(work: (tx: BlueprintTransaction) => Promise<T>): Promise<T>;
}
export class BlueprintApprovalError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_BLUEPRINT" | "INTEGRITY_ERROR" | "NOT_APPROVED" | "INVALID_TRANSITION" | "CONFLICT") {
    super(code); this.name = "BlueprintApprovalError";
  }
}

// v1: sorted object keys, JSON scalar encoding, ordered arrays. Validate first so
// undefined, non-finite numbers, extra fields and malformed content never hash.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function fingerprintInterviewBlueprint(input: unknown): string {
  const parsed = InterviewBlueprintSchema.safeParse(input);
  if (!parsed.success) throw new BlueprintApprovalError("INVALID_BLUEPRINT");
  return createHash("sha256").update(canonicalJson(parsed.data), "utf8").digest("hex");
}

function validateRecord(raw: unknown, scope: BlueprintScope, id?: string): BlueprintVersion {
  const parsed = RecordSchema.safeParse(raw);
  if (!parsed.success) throw new BlueprintApprovalError("INTEGRITY_ERROR");
  const row = parsed.data;
  if (row.companyId !== scope.companyId || row.jobId !== scope.jobId || (id && row.id !== id)) throw new BlueprintApprovalError("NOT_FOUND");
  if (row.status === "DRAFT") {
    if (row.approvedById !== null || row.approvedAt !== null || row.fingerprint !== null) throw new BlueprintApprovalError("INTEGRITY_ERROR");
  } else if (!row.approvedById || !row.approvedAt || row.approvedAt < row.createdAt || row.fingerprint !== fingerprintInterviewBlueprint(row.blueprint)) {
    throw new BlueprintApprovalError("INTEGRITY_ERROR");
  }
  return row;
}

/** Internal only: actorId is trusted server identity, never an unauthenticated
 * client assertion. Returned records are not candidate/public payloads.
 * Each ID is one immutable content version; editing requires another draft.
 * Replays reauthorize and preserve the first approval's actor/time/fingerprint.
 * This does NOT enable session creation or grant future approval indefinitely:
 * integrations must check approved status at use time, in their transaction.
 */
export function createInterviewBlueprintService(store: BlueprintStore) {
  async function authorized<T>(input: BlueprintScope, work: (tx: BlueprintTransaction, scope: BlueprintScope) => Promise<T>): Promise<T> {
    const parsed = Scope.safeParse(input);
    if (!parsed.success) throw new BlueprintApprovalError("NOT_FOUND");
    return store.transaction(async tx => {
      if (!await tx.authorize(parsed.data)) throw new BlueprintApprovalError("NOT_FOUND");
      return work(tx, parsed.data);
    });
  }
  async function load(tx: BlueprintTransaction, scope: BlueprintScope, id: string, lock: boolean) {
    if (!Id.safeParse(id).success) throw new BlueprintApprovalError("NOT_FOUND");
    const row = await tx.find(scope, id, lock);
    if (!row) throw new BlueprintApprovalError("NOT_FOUND");
    // Recheck after a potentially blocking row lock, including approval replays.
    if (lock && !await tx.authorize(scope)) throw new BlueprintApprovalError("NOT_FOUND");
    return validateRecord(row, scope, id);
  }
  return {
    createDraft: (scope: BlueprintScope, input: unknown) => authorized(scope, async (tx, s) => {
      const blueprint = InterviewBlueprintSchema.safeParse(input);
      if (!blueprint.success) throw new BlueprintApprovalError("INVALID_BLUEPRINT");
      return validateRecord(await tx.insert(s, blueprint.data), s);
    }),
    readApproved: (scope: BlueprintScope, id: string) => authorized(scope, async (tx, s) => {
      const row = await load(tx, s, id, false);
      if (row.status !== "APPROVED") throw new BlueprintApprovalError("NOT_APPROVED");
      return row;
    }),
    approve: (scope: BlueprintScope, id: string) => authorized(scope, async (tx, s) => {
      const row = await load(tx, s, id, true);
      if (row.status === "APPROVED") return row;
      if (row.status !== "DRAFT") throw new BlueprintApprovalError("INVALID_TRANSITION");
      const approved = await tx.approve(s, id, fingerprintInterviewBlueprint(row.blueprint));
      if (!approved) throw new BlueprintApprovalError("CONFLICT");
      return validateRecord(approved, s, id);
    }),
    revoke: (scope: BlueprintScope, id: string) => authorized(scope, async (tx, s) => {
      const row = await load(tx, s, id, true);
      if (row.status === "REVOKED") return row;
      if (row.status !== "APPROVED") throw new BlueprintApprovalError("INVALID_TRANSITION");
      const revoked = await tx.revoke(s, id);
      if (!revoked) throw new BlueprintApprovalError("CONFLICT");
      return validateRecord(revoked, s, id);
    }),
  };
}
