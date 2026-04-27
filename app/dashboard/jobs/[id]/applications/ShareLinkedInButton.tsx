"use client";

// app/dashboard/jobs/[id]/applications/ShareLinkedInButton.tsx

import { useState } from "react";

type Props = {
  jobId: string;
  jobTitle: string;
  jobLocation?: string | null;
};

export default function ShareLinkedInButton({ jobId, jobTitle, jobLocation }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = `${window.location.origin}/jobs/${jobId}`;
    const text = [
      `🚀 Estamos contratando: ${jobTitle}`,
      jobLocation ? `📍 ${jobLocation}` : null,
      ``,
      `¿Conoces a alguien que encaje? Aplica aquí:`,
      url,
    ]
      .filter((l) => l !== null)
      .join("\n");

    window.open(
      `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="
        inline-flex items-center gap-1.5
        whitespace-nowrap rounded-full
        border border-[#0077B5]/30
        bg-[#0077B5]/10
        px-3 py-2
        text-xs font-medium
        text-[#0077B5]
        shadow-sm
        transition-all
        hover:bg-[#0077B5]/20
        active:scale-[0.97]
        min-h-[36px]
        dark:border-[#0077B5]/30
        dark:bg-[#0077B5]/10
        dark:text-[#60b3d7]
        dark:hover:bg-[#0077B5]/20
        sm:px-4
      "
    >
      {/* LinkedIn icon */}
      <svg
        className="h-3.5 w-3.5 shrink-0"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20.447 20.452H17.21v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.984V9h3.102v1.561h.046c.432-.818 1.487-1.681 3.061-1.681 3.273 0 3.876 2.154 3.876 4.958v6.614zM5.337 7.433a1.8 1.8 0 110-3.6 1.8 1.8 0 010 3.6zm1.552 13.019H3.785V9h3.104v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
      <span className="hidden sm:inline">Compartir</span>
      <span className="sm:hidden">LinkedIn</span>
    </button>
  );
}