"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Play } from "lucide-react";

const codeLines = [
  { className: "text-violet-300", text: "const hiringDecision = {" },
  { className: "text-sky-200", text: '  role: "Python Developer",' },
  { className: "text-sky-200", text: '  candidate: "Juan Pérez",', mobileHidden: true },
  { className: "text-emerald-300", text: "  technicalScore: 87," },
  { className: "text-amber-200", text: '  codeAssessment: "completed",', mobileHidden: true },
  { className: "text-emerald-300", text: '  recommendation: "advance"' },
  { className: "text-violet-300", text: "}" },
];

export default function CodeEditorStory() {
  const totalCharacters = useMemo(
    () => codeLines.reduce((total, line) => total + line.text.length + 1, 0),
    [],
  );
  const [visibleCharacters, setVisibleCharacters] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setVisibleCharacters(totalCharacters);
      return;
    }

    let frame = 0;
    let interval: number | undefined;
    const startDelay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        frame += 2;
        setVisibleCharacters(Math.min(frame, totalCharacters));
        if (frame >= totalCharacters && interval) window.clearInterval(interval);
      }, 28);
    }, 350);

    return () => {
      window.clearTimeout(startDelay);
      if (interval) window.clearInterval(interval);
    };
  }, [totalCharacters]);

  let cursor = 0;

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-2xl" aria-label="Vista previa de un resultado técnico">
      <div aria-hidden="true" className="absolute -inset-3 -z-10 rounded-2xl bg-emerald-100/70 dark:bg-emerald-500/5 sm:-inset-5" />
      <div className="overflow-hidden rounded-2xl bg-[#0b1f24] shadow-[0_8px_0_rgba(16,185,129,0.28)] ring-1 ring-black/10 dark:ring-white/10">
        <div className="flex h-12 items-center justify-between border-b border-white/10 px-3 sm:px-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffd166]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 font-mono text-[11px] text-teal-50 sm:text-xs">
            <span className="text-emerald-300">JS</span>
            hiring-decision.js
          </div>
          <span className="flex h-8 w-8 items-center justify-center text-emerald-300" aria-hidden="true">
            <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
          </span>
        </div>

        <div className="grid min-w-0 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="min-w-0 overflow-hidden px-3 py-5 font-mono text-[12px] leading-7 sm:px-5 sm:text-[13px]">
            {codeLines.map((line, index) => {
              const start = cursor;
              cursor += line.text.length + 1;
              const count = Math.max(0, Math.min(line.text.length, visibleCharacters - start));
              const isCursorLine = visibleCharacters >= start && visibleCharacters <= start + line.text.length;
              return (
                <div key={line.text} className={`flex min-w-0 ${line.mobileHidden ? "hidden sm:flex" : ""}`}>
                  <span className="mr-3 w-4 shrink-0 select-none text-right text-teal-100/30">{index + 1}</span>
                  <span className={`min-w-0 whitespace-pre ${line.className}`}>
                    <span>{line.text.slice(0, count)}</span>
                    <span className="invisible" aria-hidden="true">{line.text.slice(count)}</span>
                    {isCursorLine && visibleCharacters < totalCharacters && <span className="code-cursor ml-px inline-block h-[1.05em] w-px translate-y-0.5 bg-emerald-300" aria-hidden="true" />}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="hidden border-l border-white/10 bg-black/10 p-4 sm:block">
            <p className="font-mono text-[10px] text-teal-100/50">ASSESSMENT</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-white">87</span>
              <span className="text-sm text-teal-100/50">/100</span>
            </div>
            <div className="mt-4 space-y-2 text-xs text-teal-50/80">
              <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-300" /> 18 tests</p>
              <p className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-300" /> Código revisado</p>
            </div>
            <div className="mt-5 rounded-md bg-emerald-400/15 px-2.5 py-2 text-xs font-semibold text-emerald-300">Avanzar</div>
          </div>
        </div>

        <div className="flex min-h-9 items-center justify-between border-t border-white/10 px-3 font-mono text-[10px] text-teal-100/50 sm:px-5 sm:text-[11px]">
          <span>Python Developer</span>
          <span className="flex items-center gap-1.5 text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Assessment complete</span>
        </div>
      </div>
    </div>
  );
}
