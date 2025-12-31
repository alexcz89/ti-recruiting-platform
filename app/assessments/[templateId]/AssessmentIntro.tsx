// app/assessments/[templateId]/AssessmentIntro.tsx
'use client';

import { Clock, FileText, Award, AlertCircle } from 'lucide-react';

type Props = {
  template: any;
  onStart: () => void;
};

export default function AssessmentIntro({ template, onStart }: Props) {
  const sections = template.sections as any[];

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-default mb-4">{template.title}</h1>
          <p className="text-lg text-muted">{template.description}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-2xl border glass-card text-center">
            <FileText className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">{template.totalQuestions}</p>
            <p className="text-sm text-muted">Preguntas</p>
          </div>

          <div className="p-6 rounded-2xl border glass-card text-center">
            <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">{template.timeLimit}</p>
            <p className="text-sm text-muted">Minutos</p>
          </div>

          <div className="p-6 rounded-2xl border glass-card text-center">
            <Award className="h-8 w-8 text-violet-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-default">{template.passingScore}%</p>
            <p className="text-sm text-muted">Para aprobar</p>
          </div>
        </div>

        {/* Secciones */}
        <div className="mb-8 p-6 rounded-2xl border glass-card">
          <h2 className="text-lg font-semibold mb-4">📋 Secciones de la evaluación</h2>
          <div className="space-y-3">
            {sections.map((section: any) => (
              <div
                key={section.name}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900"
              >
                <div>
                  <p className="font-medium text-default">{section.name}</p>
                  <p className="text-sm text-muted">
                    {section.questions} preguntas · {section.weight}% del score
                  </p>
                </div>
                <span className="text-sm text-muted">~{section.timeLimit} min</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mb-8 p-6 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Instrucciones importantes
              </h3>
              <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <li>• Una vez iniciada, el tiempo corre automáticamente</li>
                <li>• Puedes navegar entre preguntas libremente</li>
                <li>• Tus respuestas se guardan automáticamente</li>
                <li>
                  • {template.allowRetry ? `Puedes intentar hasta ${template.maxAttempts} veces` : 'Solo tienes 1 intento'}
                </li>
                {template.penalizeWrong && (
                  <li>• Las respuestas incorrectas restan puntos (-0.25)</li>
                )}
                <li>• No cambies de ventana durante la evaluación</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Botón de inicio */}
        <div className="text-center">
          <button onClick={onStart} className="btn btn-primary text-lg px-8 py-3">
            Comenzar evaluación →
          </button>
          <p className="mt-4 text-sm text-muted">
            Al hacer clic, el cronómetro comenzará inmediatamente
          </p>
        </div>
      </div>
    </main>
  );
}