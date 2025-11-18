"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";

type Props = {
  value: string;               // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;          // px
};

export default function RichTextLite({
  value,
  onChange,
  placeholder = "",
  className = "",
  minHeight = 260,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // pinta el HTML controlado
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // evita loop si ya coincide
    if (el.innerHTML !== value) el.innerHTML = value || "";
  }, [value]);

  // comandos del toolbar
  const exec = (cmd: string) => {
    // asegura foco
    ref.current?.focus();
    // ejecuta
    document.execCommand(cmd, false);
    // sincroniza state
    sync();
  };

  // sincroniza el HTML hacia arriba (con sanitización)
  const sync = () => {
    const html = ref.current?.innerHTML || "";
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["b", "strong", "i", "em", "ul", "li", "br", "p"],
      ALLOWED_ATTR: [],
    });
    onChange(clean);
  };

  // placeholder visual
  const showPlaceholder = !value?.trim();

  return (
    <div className={`w-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 rounded-md border px-3 py-2 bg-white">
        <button
          type="button"
          className="text-sm font-semibold"
          onClick={() => exec("bold")}
          aria-label="Negritas"
        >
          B
        </button>
        <span className="text-gray-300">/</span>
        <button
          type="button"
          className="text-sm italic"
          onClick={() => exec("italic")}
          aria-label="Itálicas"
        >
          i
        </button>
        <span className="text-gray-300">•</span>
        <button
          type="button"
          className="text-sm"
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
        className="mt-2 w-full rounded-md border bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
        style={{
          minHeight,
          lineHeight: "1.6",
        }}
      />

      {/* estilos para listas dentro del editor */}
      <style jsx>{`
        [contenteditable="true"] ul {
          list-style: disc;
          margin-left: 1.25rem;
          padding-left: 1rem;
        }
        [contenteditable="true"]:empty:before {
          content: "${placeholder.replace(/"/g, '\\"')}";
          color: #9ca3af; /* gray-400 */
        }
      `}</style>

      {/* capa de placeholder (fallback para navegadores que no pinten :empty) */}
      {showPlaceholder ? null : null}
    </div>
  );
}
