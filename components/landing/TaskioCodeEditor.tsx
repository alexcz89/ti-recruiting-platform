"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Braces, Check, FileCode2 } from "lucide-react";

type CodeToken = {
  text: string;
  className: string;
};

const keyword = "text-violet-300";
const callable = "text-amber-200";
const string = "text-emerald-300";
const plain = "text-teal-50";
const muted = "text-slate-400";

const codeLines: CodeToken[][] = [
  [
    { text: "from ", className: keyword },
    { text: "taskio", className: plain },
    { text: " import ", className: keyword },
    { text: "(", className: muted },
  ],
  [{ text: "    ATS, AIMatch,", className: plain }],
  [{ text: "    Assessment, CodingChallenge,", className: plain }],
  [{ text: ")", className: muted }],
  [],
  [
    { text: "challenge", className: plain },
    { text: " = ", className: muted },
    { text: "CodingChallenge", className: callable },
    { text: "(", className: plain },
  ],
  [
    { text: "    slug", className: plain },
    { text: "=", className: muted },
    { text: '"is-palindrome"', className: string },
    { text: ",", className: plain },
  ],
  [
    { text: "    language", className: plain },
    { text: "=", className: muted },
    { text: '"python"', className: string },
    { text: ",", className: plain },
  ],
  [
    { text: "    tests", className: plain },
    { text: "=", className: muted },
    { text: "8", className: "text-sky-300" },
    { text: ",", className: plain },
  ],
  [{ text: ")", className: plain }],
  [],
  [
    { text: "result", className: plain },
    { text: " = ", className: muted },
    { text: "Assessment", className: plain },
    { text: ".run", className: callable },
    { text: "(candidate, challenge)", className: plain },
  ],
  [
    { text: "match", className: plain },
    { text: " = ", className: muted },
    { text: "AIMatch", className: plain },
    { text: ".score", className: callable },
    { text: "(candidate, job)", className: plain },
  ],
  [],
  [
    { text: "ATS", className: plain },
    { text: ".attach", className: callable },
    { text: "(", className: plain },
  ],
  [{ text: "    application=application,", className: plain }],
  [{ text: "    assessment=result,", className: plain }],
  [{ text: "    match=match,", className: plain }],
  [{ text: ")", className: plain }],
];

export default function TaskioCodeEditor() {
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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleCharacters(totalCharacters);
      return;
    }

    let typingInterval: number | undefined;
    const startTimeout = window.setTimeout(() => {
      typingInterval = window.setInterval(() => {
        setVisibleCharacters((current) => {
          const next = Math.min(current + 4, totalCharacters);
          if (next === totalCharacters && typingInterval) window.clearInterval(typingInterval);
          return next;
        });
      }, 28);
    }, 280);

    return () => {
      window.clearTimeout(startTimeout);
      if (typingInterval) window.clearInterval(typingInterval);
    };
  }, [totalCharacters]);

  let characterCursor = 0;

  return (
    <div
      className="taskio-code-editor overflow-hidden rounded-2xl border border-white/10 bg-[#071b20] text-white shadow-[0_24px_70px_rgba(2,22,27,0.22)]"
      aria-label="Código Python que explica qué es TaskIO"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-[#0a242a] px-3 sm:px-5">
        <div className="flex min-w-0 self-stretch">
          <div className="flex min-w-0 items-center gap-2 border-b-2 border-emerald-400 px-2 font-mono text-xs font-semibold text-teal-50 sm:px-3 sm:text-sm">
            <FileCode2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span className="truncate">taskio_overview.py</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] text-teal-100/65 sm:text-xs">
          <Braces className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          Python 3.12
          <Check className="hidden h-3.5 w-3.5 text-emerald-300 sm:block" aria-hidden="true" />
        </div>
      </div>

      <div className="taskio-code-lines overflow-hidden px-2 py-4 font-mono text-[0.6875rem] leading-[1.55rem] min-[360px]:text-xs sm:px-5 sm:py-6 sm:text-sm sm:leading-7 lg:px-7 lg:py-7 lg:text-[0.9375rem] lg:leading-[1.85rem]">
        {codeLines.map((line, lineIndex) => {
          const lineLength = line.reduce((total, token) => total + token.text.length, 0);
          const lineStart = characterCursor;
          characterCursor += lineLength;
          const visibleOnLine = Math.max(0, Math.min(lineLength, visibleCharacters - lineStart));
          let tokenCursor = 0;

          return (
            <div key={lineIndex} className="flex min-w-0">
              <span className="mr-2 w-5 shrink-0 select-none text-right text-teal-100/30 sm:mr-5 sm:w-6">
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
                    <span key={`${lineIndex}-${tokenIndex}`} className={token.className}>
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

      <p className="sr-only">
        Ejemplo conceptual de una API de TaskIO que crea un reto de código en Python, ejecuta una
        evaluación, calcula AI Match y adjunta ambos resultados a una postulación en el ATS.
      </p>
    </div>
  );
}
