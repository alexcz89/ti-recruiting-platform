"use client";

import React, { useEffect, useRef, useState } from "react";

export type ReasonCode = "CORRECTION" | "PROCESS_CHANGE" | "ADDITIONAL_REVIEW" | "NEW_INFORMATION" | "RECONSIDERED" | "OTHER";

const reasons: Array<{ value: ReasonCode; label: string }> = [
  { value: "CORRECTION", label: "Corrección de etapa" },
  { value: "PROCESS_CHANGE", label: "Cambio en el proceso" },
  { value: "ADDITIONAL_REVIEW", label: "Revisión adicional" },
  { value: "NEW_INFORMATION", label: "Nueva información" },
  { value: "RECONSIDERED", label: "Reconsideración" },
  { value: "OTHER", label: "Otro" },
];

type DialogProps = {
  title: string;
  pending: boolean;
  onCancel: () => void;
  description?: string;
} & (
  { confirmationOnly: true; onConfirm: () => void } |
  { confirmationOnly?: false; onConfirm: (reason: { reasonCode: ReasonCode; reasonText?: string }) => void }
);

export default function ProcessReasonDialog(props: DialogProps) {
  const { title, pending, onCancel, description } = props;
  const confirmationOnly = props.confirmationOnly === true;
  const dialog = useRef<HTMLDialogElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && typeof element.showModal === "function") element.showModal();
    else if (element) element.open = true; // DOM test environments without showModal.
    const focusCurrent = () => (confirmationOnly ? cancelButton.current : select.current)?.focus();
    focusCurrent();
    const focusAfterMenuClose = window.setTimeout(focusCurrent, 0);
    return () => {
      window.clearTimeout(focusAfterMenuClose);
      if (element?.open && typeof element.close === "function") element.close();
      previousFocus?.focus();
    };
  }, [confirmationOnly]);

  function confirm() {
    if (props.confirmationOnly) { props.onConfirm(); return; }
    if (!reasonCode) { setError("Selecciona un motivo."); return; }
    if (reasonCode === "OTHER" && !reasonText.trim()) { setError("Describe el motivo cuando seleccionas Otro."); return; }
    props.onConfirm({ reasonCode, ...(reasonText.trim() ? { reasonText: reasonText.trim() } : {}) });
  }

  return <dialog ref={dialog} aria-labelledby="process-reason-title"
    onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    className="max-h-[calc(100vh_-_2rem)] w-[calc(100vw_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-xl backdrop:bg-black/45 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50">
    <h2 id="process-reason-title" className="text-base font-semibold">{title}</h2>
    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description ?? "El motivo quedará registrado en el historial."}</p>
    {!confirmationOnly && <>
    <label htmlFor="process-reason-code" className="mt-4 block text-sm font-medium">Motivo</label>
    <select ref={select} id="process-reason-code" value={reasonCode} disabled={pending}
      onChange={(event) => { setReasonCode(event.target.value as ReasonCode | ""); setError(""); }}
      className="mt-1 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
      <option value="">Selecciona un motivo</option>{reasons.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
    </select>
    <label htmlFor="process-reason-note" className="mt-4 block text-sm font-medium">Nota {reasonCode === "OTHER" ? "(obligatoria)" : "(opcional)"}</label>
    <textarea id="process-reason-note" value={reasonText} maxLength={500} rows={3} disabled={pending}
      onChange={(event) => { setReasonText(event.target.value); setError(""); }}
      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
    {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </>}
    <div className="mt-5 flex justify-end gap-2">
      <button ref={cancelButton} type="button" disabled={pending} onClick={onCancel} className="h-11 rounded-lg border border-zinc-300 px-4 text-sm dark:border-zinc-700">Cancelar</button>
      <button type="button" disabled={pending} onClick={confirm} className={`h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 ${confirmationOnly ? "bg-rose-700 hover:bg-rose-800" : "bg-emerald-600 hover:bg-emerald-700"}`}>{pending ? "Guardando…" : "Confirmar"}</button>
    </div>
  </dialog>;
}
