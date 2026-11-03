import {
  APPLICATION_STAGES,
  TERMINAL_DISPOSITIONS,
  type ApplicationDispositionValue,
  type ApplicationStageValue,
  type CanonicalApplicationState,
  type PlannedApplicationTransition,
} from "./types";
import { recruitingStateRequirements, recruitingStateTarget, type RecruitingState } from "./recruiter-state";

export class InvalidApplicationTransitionError extends Error {
  readonly code = "INVALID_APPLICATION_TRANSITION";

  constructor(message: string) {
    super(message);
    this.name = "InvalidApplicationTransitionError";
  }
}
type TransitionTarget = {
  targetStage?: ApplicationStageValue;
  targetDisposition?: ApplicationDispositionValue;
  reasonCode?: string;
  reasonText?: string;
  allowReopen?: boolean;
};

const stagePosition = new Map(
  APPLICATION_STAGES.map((stage, index) => [stage, index]),
);

function isTerminal(disposition: ApplicationDispositionValue) {
  return (TERMINAL_DISPOSITIONS as readonly ApplicationDispositionValue[]).includes(
    disposition,
  );
}

function hasReason(target: TransitionTarget) {
  return Boolean(target.reasonCode?.trim());
}

export function assertCanonicalApplicationState(
  state: CanonicalApplicationState,
) {
  const terminal = isTerminal(state.disposition);
  if (state.stage === "CLOSED" && !terminal) {
    throw new InvalidApplicationTransitionError(
      `CLOSED no puede combinarse con ${state.disposition}`,
    );
  }
  if (state.stage !== "CLOSED" && terminal) {
    throw new InvalidApplicationTransitionError(
      `${state.disposition} requiere stage CLOSED`,
    );
  }
}

export function planApplicationTransition(
  current: CanonicalApplicationState,
  target: TransitionTarget,
): PlannedApplicationTransition {
  assertCanonicalApplicationState(current);

  if (current.stage === "CLOSED" || isTerminal(current.disposition)) {
    if (
      target.allowReopen === true &&
      current.stage === "CLOSED" &&
      current.disposition === "REJECTED" &&
      target.targetStage === "REVIEW" &&
      target.targetDisposition === "ACTIVE" &&
      hasReason(target)
    ) {
      return {
        stage: "REVIEW",
        disposition: "ACTIVE",
        transitionClass: "REOPEN",
      };
    }
    throw new InvalidApplicationTransitionError(
      "La reapertura requiere REOPEN_REJECTED desde CLOSED / REJECTED",
    );
  }

  let stage = target.targetStage ?? current.stage;
  const disposition = target.targetDisposition ?? current.disposition;

  if (isTerminal(disposition)) {
    stage = "CLOSED";
  }

  if (disposition === "HOLD" && stage !== current.stage) {
    throw new InvalidApplicationTransitionError(
      "HOLD conserva la etapa actual",
    );
  }

  if (
    current.disposition === "HOLD" &&
    disposition === "ACTIVE" &&
    stage !== current.stage
  ) {
    throw new InvalidApplicationTransitionError(
      "Reanudar desde HOLD conserva la etapa actual",
    );
  }

  const next = { stage, disposition };
  assertCanonicalApplicationState(next);

  if (stage === current.stage && disposition === current.disposition) {
    throw new InvalidApplicationTransitionError(
      "La transición no cambia el estado",
    );
  }

  if (stage === current.stage) {
    return { ...next, transitionClass: "DISPOSITION_ONLY" };
  }

  const fromPosition = stagePosition.get(current.stage);
  const toPosition = stagePosition.get(stage);
  if (fromPosition === undefined || toPosition === undefined) {
    throw new InvalidApplicationTransitionError("Stage desconocido");
  }

  if (toPosition < fromPosition) {
    if (!hasReason(target)) {
      throw new InvalidApplicationTransitionError(
        "Los retrocesos requieren una razón explícita",
      );
    }
    return { ...next, transitionClass: "BACKWARD" };
  }

  return {
    ...next,
    transitionClass:
      toPosition - fromPosition > 1 && stage !== "CLOSED"
        ? "FORWARD_SKIP"
        : "NORMAL",
  };
}

/** Explicit recruiter command only; existing commands retain their own contracts. */
export function planRecruiterStateChange(current: CanonicalApplicationState, destination: RecruitingState, reasonCode?: string): PlannedApplicationTransition {
  assertCanonicalApplicationState(current);
  const target = recruitingStateTarget(current, destination);
  const requirements = recruitingStateRequirements(current, destination);
  if (requirements.requiresReason && !reasonCode?.trim()) {
    throw new InvalidApplicationTransitionError("El retroceso o reapertura requiere un motivo explícito");
  }
  if (current.stage === target.stage && current.disposition === target.disposition) {
    throw new InvalidApplicationTransitionError("La transición no cambia el estado");
  }
  return { ...target, transitionClass: current.stage === "CLOSED" ? (target.stage === "CLOSED" ? "DISPOSITION_ONLY" : "REOPEN")
    : requirements.requiresReason ? "BACKWARD" : current.stage === target.stage ? "DISPOSITION_ONLY"
    : APPLICATION_STAGES.indexOf(target.stage) - APPLICATION_STAGES.indexOf(current.stage) > 1 && target.stage !== "CLOSED" ? "FORWARD_SKIP" : "NORMAL" };
}
