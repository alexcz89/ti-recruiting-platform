import {
  APPLICATION_STAGES,
  TERMINAL_DISPOSITIONS,
  type ApplicationDispositionValue,
  type ApplicationStageValue,
  type CanonicalApplicationState,
  type PlannedApplicationTransition,
} from "./types";

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
    throw new InvalidApplicationTransitionError(
      "REOPEN está fuera de este slice",
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
