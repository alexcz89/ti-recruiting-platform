"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, FileCode2, LoaderCircle, Play, Terminal } from "lucide-react";

type CodeToken = {
  text: string;
  className: string;
};

const codeLines: CodeToken[][] = [
  [
    { text: "def ", className: "text-sky-300" },
    { text: "is_palindrome", className: "text-amber-200" },
    { text: "(text):", className: "text-teal-50" },
  ],
  [
    { text: "    text", className: "text-teal-50" },
    { text: " = ", className: "text-slate-400" },
    { text: "text.lower", className: "text-sky-200" },
    { text: "()", className: "text-teal-50" },
  ],
  [
    { text: "    return ", className: "text-violet-300" },
    { text: "text", className: "text-teal-50" },
    { text: " == ", className: "text-slate-400" },
    { text: "text", className: "text-teal-50" },
    { text: "[::-1]", className: "text-emerald-300" },
  ],
];

const tests = Array.from({ length: 8 }, (_, index) => `Prueba ${index + 1}`);

export default function CodeAssessmentDemo() {
  const totalCharacters = useMemo(
    () =>
      codeLines.reduce(
        (lineTotal, line) =>
          lineTotal + line.reduce((tokenTotal, token) => tokenTotal + token.text.length, 0),
        0,
      ),
    [],
  );
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [passedTests, setPassedTests] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setVisibleCharacters(totalCharacters);
      setPassedTests(tests.length);
      setShowScore(true);
      setShowRecommendation(true);
      return;
    }

    const timeouts: number[] = [];
    let typingInterval: number | undefined;

    timeouts.push(
      window.setTimeout(() => {
        typingInterval = window.setInterval(() => {
          setVisibleCharacters((current) => {
            const next = Math.min(current + 2, totalCharacters);
            if (next === totalCharacters && typingInterval) window.clearInterval(typingInterval);
            return next;
          });
        }, 24);
      }, 500),
    );

    timeouts.push(window.setTimeout(() => setIsRunning(true), 2300));
    tests.forEach((_, index) => {
      timeouts.push(window.setTimeout(() => setPassedTests(index + 1), 3000 + index * 280));
    });
    timeouts.push(window.setTimeout(() => setIsRunning(false), 5100));
    timeouts.push(window.setTimeout(() => setShowScore(true), 5500));
    timeouts.push(window.setTimeout(() => setShowRecommendation(true), 6100));

    return () => {
      timeouts.forEach(window.clearTimeout);
      if (typingInterval) window.clearInterval(typingInterval);
    };
  }, [totalCharacters]);

  const liveStatus = showRecommendation
    ? "Evaluación completada. Puntaje técnico 87 de 100. Resultado: aprobado."
    : showScore
      ? "Puntaje técnico calculado: 87 de 100."
      : passedTests > 0
        ? `${passedTests} de 8 tests aprobados.`
        : isRunning
          ? "Ejecutando tests."
          : visibleCharacters < totalCharacters
            ? "El candidato está escribiendo la solución."
            : "Solución lista para ejecutar.";

  let characterCursor = 0;
  const assessmentCompleted = passedTests === tests.length;

  return (
    <div
      className="assessment-demo-shell overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-[0_6px_8px_rgba(2,13,16,0.12)] dark:border-white/15 dark:bg-[#181f23] dark:shadow-none"
      aria-label="Simulación de una evaluación técnica de TaskIO"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2.5 dark:border-white/10 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <Terminal className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
              Evaluación técnica TaskIO
            </p>
            <p className="hidden text-xs text-zinc-600 dark:text-zinc-400 sm:block">
              Python · Nivel junior
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <span
            className="h-2 w-2 rounded-full bg-emerald-500"
            aria-label={assessmentCompleted ? "Evaluación completada" : "Evaluación en curso"}
          />
          <span className="hidden sm:inline">
            {assessmentCompleted ? "Evaluación completada" : "Evaluación en curso"}
          </span>
        </div>
      </div>

      <div className="assessment-demo-body min-w-0">
        <section
          aria-labelledby="assessment-problem-title"
          className="border-b border-zinc-200 p-4 dark:border-white/10 sm:p-5 lg:border-b-0 lg:border-r lg:p-6"
        >
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span>Problema técnico</span>
            <span className="font-mono tabular-nums">1 / 1</span>
          </div>
          <h2
            id="assessment-problem-title"
            className="mt-4 text-balance font-display text-2xl font-extrabold tracking-[-0.025em] text-zinc-950 dark:text-white lg:text-3xl"
          >
            ¿Es Palíndromo?
          </h2>
          <p className="mt-3 text-pretty text-base leading-7 text-zinc-700 dark:text-zinc-300">
            Determina si una palabra se lee igual de izquierda a derecha y de derecha a izquierda.
          </p>
          <dl className="mt-5 border-t border-zinc-200 pt-5 dark:border-white/10 lg:mt-7">
            <dt className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Entrada</dt>
            <dd className="mt-2 rounded-lg bg-zinc-100 px-4 py-3 font-mono text-base text-zinc-950 dark:bg-[#10181c] dark:text-teal-50">
              radar
            </dd>
          </dl>
        </section>

        <div className="assessment-workspace min-w-0">
          <section aria-label="Código del candidato" className="landing-editor min-h-[15rem] min-w-0 text-white">
            <div className="flex min-h-11 items-center justify-between border-b border-white/10 px-3 sm:px-4">
              <div className="flex h-11 items-center gap-2 border-b-2 border-emerald-400 px-1 font-mono text-xs font-semibold text-teal-50 sm:text-sm">
                <FileCode2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                candidate.py
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-teal-100/70">
                <span className="hidden sm:inline">Python 3</span>
                <Play className="h-4 w-4 text-emerald-300" fill="currentColor" aria-hidden="true" />
              </div>
            </div>

            <div className="px-3 py-6 font-mono text-[0.8125rem] leading-8 sm:px-5 sm:text-sm lg:py-7 xl:text-[0.9375rem]">
              {codeLines.map((line, lineIndex) => {
                const lineLength = line.reduce((total, token) => total + token.text.length, 0);
                const lineStart = characterCursor;
                characterCursor += lineLength;
                const visibleOnLine = Math.max(
                  0,
                  Math.min(lineLength, visibleCharacters - lineStart),
                );
                let tokenCursor = 0;

                return (
                  <div key={lineIndex} className="flex min-w-0">
                    <span className="mr-4 w-4 shrink-0 select-none text-right text-teal-100/35">
                      {lineIndex + 1}
                    </span>
                    <code className="min-w-0 whitespace-pre" aria-hidden="true">
                      {line.map((token, tokenIndex) => {
                        const tokenVisible = Math.max(
                          0,
                          Math.min(token.text.length, visibleOnLine - tokenCursor),
                        );
                        tokenCursor += token.text.length;
                        return (
                          <span key={`${token.text}-${tokenIndex}`} className={token.className}>
                            <span>{token.text.slice(0, tokenVisible)}</span>
                            <span className="invisible">{token.text.slice(tokenVisible)}</span>
                          </span>
                        );
                      })}
                      {visibleCharacters >= lineStart &&
                        visibleCharacters <= lineStart + lineLength &&
                        visibleCharacters < totalCharacters && (
                          <span
                            className="code-cursor ml-px inline-block h-[1.05em] w-px translate-y-0.5 bg-emerald-300"
                            aria-hidden="true"
                          />
                        )}
                    </code>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="assessment-results-grid min-w-0 border-t border-white/10 bg-[#0d252a] text-white">
            <section aria-labelledby="test-results-title" className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="test-results-title" className="text-sm font-bold text-white sm:text-base">
                  Resultados de pruebas
                </h3>
                <span className="flex items-center gap-2 font-mono text-xs font-semibold text-emerald-300 sm:text-sm">
                  {isRunning && passedTests < tests.length ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : passedTests === tests.length ? (
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  ) : (
                    <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                  )}
                  {isRunning && passedTests < tests.length
                    ? "Ejecutando pruebas..."
                    : passedTests === tests.length
                      ? "8/8 pruebas aprobadas"
                      : "Listo para ejecutar"}
                </span>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-4">
                {tests.map((test, index) => {
                  const passed = index < passedTests;
                  return (
                    <li
                      key={test}
                      className={`flex items-center gap-2 text-xs transition-colors duration-200 sm:text-sm ${
                        passed ? "text-teal-50" : "text-teal-100/40"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                          passed ? "bg-emerald-400 text-[#062b27]" : "border border-white/15"
                        }`}
                      >
                        {passed && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
                      </span>
                      {test}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-labelledby="candidate-evidence-title"
              className="border-t border-white/10 p-4 sm:p-5 lg:border-l lg:border-t-0"
            >
              <h3 id="candidate-evidence-title" className="text-sm font-bold text-white sm:text-base">
                Evaluación del candidato
              </h3>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-1 lg:gap-3">
                <div
                  className={`transition-opacity duration-300 ${showScore ? "opacity-100" : "opacity-35"}`}
                >
                  <dt className="text-xs text-teal-100/65">Puntaje técnico</dt>
                  <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                    {showScore ? "87/100" : "—/100"}
                  </dd>
                </div>
                <div
                  className={`transition-opacity duration-300 ${showScore ? "opacity-100" : "opacity-35"}`}
                >
                  <dt className="text-xs text-teal-100/65">Pruebas aprobadas</dt>
                  <dd className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                    {showScore ? "8/8" : "—/8"}
                  </dd>
                </div>
                <div
                  className={`col-span-2 border-t border-white/10 pt-3 transition-opacity duration-300 lg:col-span-1 ${
                    showRecommendation ? "opacity-100" : "opacity-35"
                  }`}
                >
                  <dt className="text-xs text-teal-100/65">Resultado</dt>
                  <dd className="mt-2 inline-flex rounded-md bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    {showRecommendation ? "Aprobado" : "Pendiente"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveStatus}
      </p>
    </div>
  );
}
