"use client";

// components/dashboard/AssignTemplateModalTrigger.tsx
// Se monta en jobs/page.tsx (Server Component) y detecta ?assignTemplate= en la URL

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Suspense, lazy, useCallback } from "react";

const AssignTemplateModal = lazy(() => import("./AssignTemplateModal"));

type Job = {
  id: string;
  title: string;
  location: string | null;
  remote: boolean;
  status: string;
  assignedTemplateIds: string[];
};

type Template = {
  id: string;
  title: string;
  description: string;
  difficulty: "JUNIOR" | "MID" | "SENIOR";
  type: "MCQ" | "CODING" | "MIXED";
  totalQuestions: number;
  timeLimit: number;
  passingScore: number;
};

type Props = {
  jobs: Job[];
  templates: Template[];
};

function Inner({ jobs, templates }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const assignTemplateId = searchParams.get("assignTemplate");
  const template = assignTemplateId
    ? templates.find((t) => t.id === assignTemplateId) ?? null
    : null;

  const handleClose = useCallback(() => {
    // Quitar el param de la URL sin recargar
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("assignTemplate");
    const qs = sp.toString();
    router.replace(pathname + (qs ? `?${qs}` : ""), { scroll: false });
  }, [router, pathname, searchParams]);

  if (!assignTemplateId) return null;

  return (
    <Suspense fallback={null}>
      <AssignTemplateModal
        templateId={assignTemplateId}
        templateTitle={template?.title ?? "Template"}
        template={template}
        jobs={jobs}
        onClose={handleClose}
      />
    </Suspense>
  );
}

export default function AssignTemplateModalTrigger({ jobs, templates }: Props) {
  return (
    <Suspense fallback={null}>
      <Inner jobs={jobs} templates={templates} />
    </Suspense>
  );
}