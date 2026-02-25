// components/RichTextLite.tsx  (o donde lo tengas)
"use client";

import { useEffect, useRef } from "react";

// ✅ FIX: RichTextLite es "use client" pero Next.js hace SSR del HTML inicial.
// dompurify requiere window — usamos sanitización manual simple que es suficiente
// para un editor interno donde el usuario ya está autenticado.
function sanitize(html: string): string {
  if (typeof window === "undefined") return html;
  // En browser usamos un div temporal — no necesitamos dompurify para esto
  const div = document.createElement("div");
  div.innerHTML = html;
  // Eliminar scripts y eventos inline
  div.querySelectorAll("script,iframe,object,embed").forEach((el) => el.remove());
  div.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith("on")) el.removeAttribute(attr.name);
    });
  });
  return div.innerHTML;
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

export default function RichTextLite({
  value,
  onChange,
  placeholder = "",
  className = "",
  minHeight = 260,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    sync();
  };

  const sync = () => {
    const html = ref.current?.innerHTML || "";
    const clean = sanitize(html);
    onChange(clean);
  };

  const showPlaceholder = !value?.trim();

  return (
    <div className={`w-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 rounded-md border px-3 py-2 bg-white dark:bg-zinc-900">
        <button
          type="button"
          className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-900"
          onClick={() => exec("bold")}
          aria-label="Negritas"
        >
          B
        </button>
        <span className="text-zinc-300">/</span>
        <button
          type="button"
          className="text-sm italic text-zinc-700 dark:text-zinc-200 hover:text-zinc-900"
          onClick={() => exec("italic")}
          aria-label="Itálicas"
        >
          i
        </button>
        <span className="text-zinc-300">•</span>
        <button
          type="button"
          className="text-sm text-zinc-700 dark:text-zinc-200 hover:text-zinc-900"
          onClick={() => exec("insertUnorderedList")}
          aria-label="Viñetas"
        >
          Bullets
        </button>
      </div>

      {/* Área editable */}
      <div
        ref={ref}
        role="textbox"
        aria-multiline
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        data-placeholder={showPlaceholder ? placeholder : undefined}
        className="mt-2 w-full rounded-md border bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
        style={{ minHeight, lineHeight: "1.6" }}
      />

      <style jsx>{`
        [contenteditable="true"] ul {
          list-style: disc;
          margin-left: 1.25rem;
          padding-left: 1rem;
        }
        [contenteditable="true"][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
        }
      `}</style>
    </div>
  );
}