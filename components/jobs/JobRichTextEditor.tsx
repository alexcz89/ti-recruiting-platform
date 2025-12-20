// components/jobs/JobRichTextEditor.tsx
"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Undo,
  Redo,
} from "lucide-react";

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string, plain: string) => void;
};

function htmlToPlain(html: string) {
  if (!html) return "";
  if (typeof window === "undefined") return "";
  const div = window.document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

export default function JobRichTextEditor({ valueHtml, onChangeHtml }: Props) {
  const [charCount, setCharCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          "Describe la vacante, responsabilidades principales, stack tecnológico y cultura del equipo…",
      }),
    ],
    content: valueHtml || "",
    editorProps: {
      attributes: {
        class: [
          "job-editor", // 👈 ESTA ES LA CLAVE
          "min-h-[220px] w-full rounded-md border border-zinc-300 bg-white p-3",
          "text-[15px] leading-relaxed outline-none",
          "dark:border-zinc-700 dark:bg-zinc-900",
          "prose prose-sm max-w-none dark:prose-invert",
          "prose-ul:list-disc prose-ul:ml-5",
          "prose-ol:list-decimal prose-ol:ml-5",
        ].join(" "),
      },
    },

    immediatelyRender: false,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      const plain = editor.getText().trim() || htmlToPlain(html);
      onChangeHtml(html, plain);

      // Contar caracteres sin espacios, igual que en el JobWizard
      const len = plain.replace(/\s+/g, "").length;
      setCharCount(len);
    },
  });

  // Sincronizar cambios externos (por ejemplo, al aplicar plantilla o al editar vacante)
  useEffect(() => {
    if (!editor) return;

    // Inicializar contador con el contenido actual
    const currentText = editor.getText().trim();
    const len = currentText.replace(/\s+/g, "").length;
    setCharCount(len);

    const currentHtml = editor.getHTML();
    if (currentHtml === (valueHtml || "")) return;

    // ⬇️ Aquí el cambio: usamos objeto de opciones en lugar de `false`
    editor.commands.setContent(valueHtml || "", { emitUpdate: false });
  }, [valueHtml, editor]);

  if (!editor) {
    return (
      <div className="min-h-[220px] w-full rounded-md border border-zinc-300 bg-white/60 p-3 text-sm text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/60">
        Cargando editor...
      </div>
    );
  }

  const baseBtn =
    "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm transition";
  const idle =
    "text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-200 dark:hover:bg-zinc-800";
  const active = "bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white";

  return (
    <div className="w-full">
      {/* Toolbar estilo Notion */}
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

        {/* Heading 2 */}
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={`${baseBtn} ${
            editor.isActive("heading", { level: 2 }) ? active : idle
          }`}
        >
          <Heading2 className="h-4 w-4" />
        </button>

        {/* Heading 3 */}
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={`${baseBtn} ${
            editor.isActive("heading", { level: 3 }) ? active : idle
          }`}
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />

        {/* Bullet list */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${baseBtn} ${
            editor.isActive("bulletList") ? active : idle
          }`}
        >
          <List className="h-4 w-4" />
        </button>

        {/* Numbered list */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${baseBtn} ${
            editor.isActive("orderedList") ? active : idle
          }`}
        >
          <ListOrdered className="h-4 w-4" />
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
    </div>
  );
}
