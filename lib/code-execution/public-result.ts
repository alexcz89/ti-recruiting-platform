import "server-only";
import type { ExecutionResult, TestResult } from "./judge0-service";

const EXECUTION_ERROR = "No se pudo ejecutar el código. Intenta de nuevo.";
const PUBLIC_STATUSES = new Set(["SUCCESS", "ERROR", "TIMEOUT", "COMPILATION_ERROR", "RUNTIME_ERROR", "MEMORY_LIMIT"]);

type PublicTestCase = { id: string; input: string; expectedOutput: string; isHidden: boolean };
type CandidateTestResult = {
  testCaseId: string; passed: boolean; hidden: boolean;
  input?: string; expectedOutput?: string; actualOutput?: string; error?: string; executionTimeMs?: number;
};

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length <= max ? value : `${value.slice(0, max)}\n…[truncated]`;
}
function metric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function status(value: unknown): string {
  return typeof value === "string" && PUBLIC_STATUSES.has(value) ? value : "ERROR";
}
function diagnostic(result: TestResult, max = 2000): string | undefined {
  if (!result.error) return undefined;
  if (result.errorSource === "status") {
    if (result.statusId === 4) return "La salida no coincide con la esperada.";
    if (result.statusId === 5) return "Tiempo de ejecución agotado.";
    if (result.statusId === 6) return "Error de compilación.";
    return "Error al ejecutar el programa.";
  }
  return result.errorSource === "program" ? text(result.error, max) : EXECUTION_ERROR;
}
function programOutput(result: TestResult, max: number): string | undefined {
  // Unknown errors are private too: only the runner may identify program diagnostics.
  if (result.errorSource === "provider" || (result.error && result.errorSource !== "program" && result.errorSource !== "status")) return undefined;
  return text(result.actualOutput, max);
}

/** The database defines visibility; aggregates and unknown result IDs are never public diagnostics. */
export function candidateExecutionResult(result: ExecutionResult, testCases: readonly PublicTestCase[], isSubmission: boolean) {
  const byId = new Map(testCases.map(test => [test.id, test]));
  const results = result.testResults ?? [];
  const hasPrivateResults = testCases.some(test => test.isHidden !== false) || results.some(test => !byId.has(test.testCaseId));
  const testResults: CandidateTestResult[] = results.map((test, index) => {
    const source = byId.get(test.testCaseId);
    if (!source || source.isHidden !== false) {
      return { testCaseId: `hidden-${index + 1}`, passed: test.passed === true, hidden: true };
    }
    return {
      testCaseId: source.id, passed: test.passed === true, hidden: false,
      ...(isSubmission ? {} : {
        input: text(source.input, 2000), expectedOutput: text(source.expectedOutput, 2000),
        actualOutput: programOutput(test, 2000),
      }),
      error: diagnostic(test), executionTimeMs: metric(test.executionTimeMs),
    };
  });
  return {
    success: result.success === true,
    status: hasPrivateResults ? (result.success === true ? "SUCCESS" : "ERROR") : status(result.status),
    output: isSubmission ? "" : text(testResults.map(test => test.actualOutput ?? "").join("\n---\n"), 8000) ?? "",
    error: text(testResults.filter(test => !test.hidden).map(test => test.error).filter(Boolean).join("\n"), 8000) || (result.error ? EXECUTION_ERROR : ""),
    ...(hasPrivateResults ? {} : { executionTimeMs: metric(result.executionTimeMs), memoryUsedMb: metric(result.memoryUsedMb) }),
    testResults,
  };
}

/** Custom runs have only the candidate's own input, never assessment test cases. */
export function candidateCustomRunResult(result: ExecutionResult) {
  const test = result.testResults?.find(test => test.testCaseId === "custom");
  return {
    output: test ? programOutput(test, 4000) ?? "" : "",
    error: (test ? diagnostic(test, 4000) : undefined) || (result.error ? EXECUTION_ERROR : ""),
    executionTimeMs: metric(result.executionTimeMs),
    status: status(result.status),
  };
}
