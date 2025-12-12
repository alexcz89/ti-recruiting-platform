// components/cv/CvExperienceEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, Undo, Redo } from "lucide-react";

type Props = {
  /** HTML almacenado en el estado del CV */
  valueHtml: string;
  /** Devuelve html y texto plano (con saltos de línea) */
  onChangeHtml: (html: string, plain: string) => void;
};

function htmlToPlain(html: string) {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  const div = window.document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export default function CvExperienceEditor({ valueHtml, onChangeHtml }: Props) {
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // no necesitamos headings aquí
        heading: false,
      }),
      Placeholder.configure({
        placeholder:
          "Cuenta tu experiencia en puntos breves (un punto por línea)…",
      }),
    ],
    content: valueHtml || "",
    editorProps: {
      attributes: {
        class: [
          "job-editor",
          "min-h-[140px] w-full rounded-md border border-zinc-300 bg-white p-3",
          "text-[14px] leading-relaxed outline-none",
          "dark:border-zinc-700 dark:bg-zinc-900",
          "prose prose-sm max-w-none dark:prose-invert",
          "prose-ul:list-disc prose-ul:ml-5",
        ].join(" "),
      },
    },
    immediatelyRender: false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      const plain = editor.getText().trim() || htmlToPlain(html);
      onChangeHtml(html, plain);

      const len = plain.replace(/\s+/g, "").length;
      setCharCount(len);
    },
  });

  // Sincronizar cambios externos de valueHtml (por ejemplo al cargar de localStorage)
  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (currentHtml === (valueHtml || "")) return;

    editor.commands.setContent(valueHtml || "", { emitUpdate: false });

    const plain = editor.getText().trim() || htmlToPlain(valueHtml || "");
    const len = plain.replace(/\s+/g, "").length;
    setCharCount(len);
  }, [valueHtml, editor]);

  if (!editor) {
    return (
      <div className="min-h-[140px] w-full rounded-md border border-zinc-300 bg-white/60 p-3 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/60">
        Cargando editor...
      </div>
    );
  }

  const baseBtn =
    "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm transition";
  const idle =
    "text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-200 dark:hover:bg-zinc-800";
  const active = "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white";

  const counterColor =
    charCount < 20
      ? "text-red-500"
      : charCount < 50
      ? "text-amber-600"
      : "text-emerald-600";

  return (
    <div className="w-full">
      {/* Toolbar: solo negritas, cursiva, bullets, undo/redo */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        {/* Bold */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${baseBtn} ${
            editor.isActive("bold") ? active : idle
          }`}
        >
          <Bold className="h-4 w-4" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${baseBtn} ${
            editor.isActive("italic") ? active : idle
          }`}
        >
          <Italic className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

        {/* Bullet list (único tipo de lista) */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${baseBtn} ${
            editor.isActive("bulletList") ? active : idle
          }`}
        >
          <List className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

        {/* Undo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={`${baseBtn} ${
            editor.can().undo()
              ? idle
              : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
          }`}
        >
          <Undo className="h-4 w-4" />
        </button>

        {/* Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={`${baseBtn} ${
            editor.can().redo()
              ? idle
              : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
          }`}
        >
          <Redo className="h-4 w-4" />
        </button>
      </div>

      <EditorContent editor={editor} />

      <div className={`mt-1 text-xs text-right ${counterColor}`}>
        {charCount} caracteres (sin espacios)
      </div>
    </div>
  );
}
