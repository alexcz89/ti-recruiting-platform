// components/assessments/CodeEditor.tsx
'use client';

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import ReactMarkdown from 'react-markdown';
import {
  Play,
  Send,
  Code2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
  Maximize2,
  Minimize2,
  Settings,
  Zap,
  Terminal,
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950">
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping">
            <Code2 className="mx-auto h-12 w-12 text-teal-500/30" />
          </div>
          <Code2 className="relative mx-auto mb-4 h-12 w-12 text-teal-500" />
        </div>
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-teal-500 dark:text-teal-400" />
        <p className="text-sm font-medium text-gray-700 dark:text-slate-300">
          Cargando editor de código...
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
          Preparando el entorno
        </p>
      </div>
    </div>
  ),
});

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  hidden?: boolean;
  input?: string;
  expectedOutput?: string;
  actualOutput?: string;
  error?: string;
  executionTimeMs?: number;
}

interface CodeEditorProps {
  questionId: string;
  attemptId: string;
  questionText: string;
  initialCode?: string;
  language: string;
  allowedLanguages: string[];
  testCases: TestCase[];
  points: number;
  onSubmit?: (code: string, language: string) => void;
  readOnly?: boolean;
}

function isNonEmptyString(v: any): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// ✅ NUEVO: limpiar el input del test case para mostrarlo legible
// El input es código runner (ej: "console.log(JSON.stringify(twoSum([2,7,11,15], 9)));")
// Extraemos solo los argumentos para mostrar algo limpio al candidato
function formatInputDisplay(input: string, language?: string): string {
  if (!input) return input;
  if (language === 'sql') return 'Dataset SQL de prueba';
  // Intentar extraer argumentos del último llamado a función
  const match = input.match(/\(([^)]+(?:\[[^\]]*\][^)]*)?)\)\s*[;)]?\s*$/);
  if (match) return match[1];
  // Si no matchea, devolver el input original truncado
  return input.length > 80 ? input.slice(0, 80) + '…' : input;
}

// ✅ Componente Markdown con estilos para el editor de código
function MarkdownContent({ content, isDark }: { content: string; isDark: boolean }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-2 text-base font-bold text-gray-900 dark:text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-base font-bold text-gray-900 dark:text-white">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 text-sm leading-relaxed text-gray-700 dark:text-slate-300">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
        ),
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <code className="block overflow-x-auto whitespace-pre text-xs font-mono text-gray-900 dark:text-slate-100">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-teal-500/10 px-1.5 py-0.5 text-xs font-mono text-teal-700 dark:text-teal-400">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-slate-800/80">
            {children}
          </pre>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-4 text-sm text-gray-700 dark:text-slate-300">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-4 text-sm text-gray-700 dark:text-slate-300">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-4 border-teal-400 pl-3 text-sm italic text-gray-500 dark:text-slate-400">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function CodeEditor({
  questionId,
  attemptId,
  questionText,
  initialCode = '',
  language: initialLanguage,
  allowedLanguages,
  testCases,
  points,
  onSubmit,
  readOnly = false,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [code, setCode] = useState(initialCode);
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'problem' | 'results' | 'custom'>('problem');
  const [hasRunTests, setHasRunTests] = useState(false);
  const [solutionSubmitted, setSolutionSubmitted] = useState(false);
  const [problemWidth, setProblemWidth] = useState(30);
  const [outputWidth, setOutputWidth] = useState(27);
  // Custom input
  const [customInput, setCustomInput] = useState('');
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  const [customOutput, setCustomOutput] = useState<{ output: string; error: string; executionTimeMs?: number } | null>(null);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCode(initialCode || '');
  }, [initialCode]);

  useEffect(() => {
    setSelectedLanguage(initialLanguage);
  }, [initialLanguage]);

  const languageNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    go: 'Go',
    rust: 'Rust',
    sql: 'SQL',
  };

  const customInputLabel =
    selectedLanguage === 'sql' ? 'Probar con datos propios' : 'Probar con mi input';

  const monacoLanguages: Record<string, string> = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    go: 'go',
    rust: 'rust',
    sql: 'sql',
  };

  const handleRunTests = async () => {
    if (isRunning || isSubmitting || readOnly) return;
    if (!code.trim()) return;

    setIsRunning(true);
    setError(null);
    setTestResults(null);
    setShowOutput(true);
    setActiveTab('results');

    try {
      const response = await fetch('/api/assessments/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          code,
          language: selectedLanguage,
          isSubmission: false,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as any).error || 'Error al ejecutar el código');
        return;
      }

      const results = (data as any)?.result?.testResults;
      setTestResults(Array.isArray(results) ? results : []);
      setHasRunTests(true); // ✅ marcar que ejecutó tests

      // ✅ AUTO-SUBMIT: si todos los tests públicos pasaron, enviar automáticamente
      if (Array.isArray(results)) {
        const publicResults = results.filter((r: any) => !r.hidden);
        const allPublicPassed = publicResults.length > 0 && publicResults.every((r: any) => r.passed);
        if (allPublicPassed && !solutionSubmitted) {
          await handleAutoSubmit(code, selectedLanguage);
        }
      }
    } catch (err) {
      console.error('Error running tests:', err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsRunning(false);
    }
  };

  // ✅ NUEVO: auto-submit silencioso cuando todos los tests públicos pasan
  const handleAutoSubmit = async (currentCode: string, currentLanguage: string) => {
    if (isSubmitting || solutionSubmitted) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/assessments/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          code: currentCode,
          language: currentLanguage,
          isSubmission: true,
        }),
      });
      if (response.ok) {
        setSolutionSubmitted(true);
        onSubmit?.(currentCode, currentLanguage);
      }
    } catch (err) {
      console.error('Error auto-submitting:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCustom = async () => {
    if (isRunningCustom || readOnly) return;
    if (!code.trim()) return;
    setIsRunningCustom(true);
    setCustomOutput(null);
    try {
      const response = await fetch('/api/assessments/code/custom-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, questionId, code, language: selectedLanguage, customInput }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setCustomOutput({ output: '', error: (data as any).error || 'Error al ejecutar' });
      } else {
        setCustomOutput({
          output: (data as any).output || '',
          error: (data as any).error || '',
          executionTimeMs: (data as any).executionTimeMs,
        });
      }
    } catch {
      setCustomOutput({ output: '', error: 'Error de conexión. Intenta de nuevo.' });
    } finally {
      setIsRunningCustom(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isRunning || readOnly) return;
    if (!code.trim()) return;
    if (solutionSubmitted) return; // ya fue enviada automáticamente
    setIsSubmitting(true);
    setError(null);
    setTestResults(null);
    setShowOutput(true);
    setActiveTab('results');

    try {
      const response = await fetch('/api/assessments/code/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          code,
          language: selectedLanguage,
          isSubmission: true,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError((data as any).error || 'Error al enviar el código');
        return;
      }

      const results = (data as any)?.result?.testResults;
      setTestResults(Array.isArray(results) ? results : []);

      setSolutionSubmitted(true);
      onSubmit?.(code, selectedLanguage);
    } catch (err) {
      console.error('Error submitting code:', err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // resolvedTheme puede ser undefined en el primer render (next-themes hidrata tarde).
  // Usamos el atributo class del <html> como fuente de verdad inmediata.
  const getIsDark = useCallback(
    () =>
      resolvedTheme === 'dark' ||
      (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')),
    [resolvedTheme]
  );

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(getIsDark() ? 'vs-dark' : 'vs');
    }
  }, [getIsDark]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.setTheme(getIsDark() ? 'vs-dark' : 'vs');

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRunTests();
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const startPanelResize = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      panel: 'problem' | 'output'
    ) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0) return;

      event.preventDefault();

      const handleMove = (moveEvent: PointerEvent) => {
        if (panel === 'problem') {
          const percent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
          setProblemWidth(Math.min(40, Math.max(22, percent)));
          return;
        }

        const percent = ((bounds.right - moveEvent.clientX) / bounds.width) * 100;
        setOutputWidth(Math.min(38, Math.max(22, percent)));
      };

      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    []
  );

  const handlePanelResizeKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLDivElement>,
      panel: 'problem' | 'output'
    ) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();

      const direction = event.key === 'ArrowLeft' ? -2 : 2;
      if (panel === 'problem') {
        setProblemWidth((current) => Math.min(40, Math.max(22, current + direction)));
        return;
      }

      setOutputWidth((current) =>
        Math.min(38, Math.max(22, current - direction))
      );
    },
    []
  );

  const passedTests = testResults?.filter((r) => r.passed).length || 0;
  const totalTests = testResults?.length || 0;

  const renderPrimaryActions = (compact: boolean) => (
    <div className={`flex ${compact ? 'gap-1.5' : 'gap-3'}`}>
      <button
        type="button"
        onClick={handleRunTests}
        disabled={isRunning || isSubmitting || !code.trim() || solutionSubmitted}
        className={`inline-flex items-center justify-center gap-2 border border-gray-300 bg-slate-800 font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 ${compact ? 'min-h-9 rounded-lg px-3 py-1.5 text-xs' : 'rounded-xl px-5 py-2.5 text-sm'}`}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Ejecutando...</span>
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            <span>{compact ? 'Ejecutar' : 'Ejecutar Tests'}</span>
          </>
        )}
      </button>

      {solutionSubmitted ? (
        <div className={`inline-flex items-center justify-center gap-2 bg-emerald-600 font-bold text-white shadow-sm ${compact ? 'min-h-9 rounded-lg px-3 py-1.5 text-xs' : 'rounded-xl px-5 py-2.5 text-sm'}`}>
          <CheckCircle2 className="h-4 w-4" />
          <span>{compact ? 'Enviada' : 'Solución enviada'}</span>
        </div>
      ) : isSubmitting ? (
        <div className={`inline-flex items-center justify-center gap-2 bg-teal-600 font-bold text-white shadow-sm ${compact ? 'min-h-9 rounded-lg px-3 py-1.5 text-xs' : 'rounded-xl px-5 py-2.5 text-sm'}`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Enviando...</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isRunning || isSubmitting || !code.trim()}
          className={`inline-flex items-center justify-center gap-2 bg-teal-600 font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'min-h-9 rounded-lg px-3 py-1.5 text-xs' : 'rounded-xl px-5 py-2.5 text-sm'}`}
        >
          <Send className="h-4 w-4" />
          <span>{compact ? 'Enviar' : 'Enviar solución'}</span>
        </button>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col bg-white text-gray-900 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950 dark:text-white"
    >
      {/* Header */}
      <div className="relative z-10 border-b border-gray-200 bg-white dark:border-slate-800/80 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800/50 dark:backdrop-blur-sm">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-teal-600 p-2">
                <Code2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                    Editor {languageNames[selectedLanguage] || selectedLanguage}
                  </h3>
                  {readOnly && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      Solo lectura
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-600 dark:text-teal-400">
                    <Zap className="h-3.5 w-3.5" />
                    {points} puntos
                  </span>
                  {testResults && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
                        passedTests === totalTests
                          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {passedTests === totalTests ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Terminal className="h-3.5 w-3.5" />
                      )}
                      {passedTests}/{totalTests} tests
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!readOnly && (
                <div className="hidden lg:block">{renderPrimaryActions(true)}</div>
              )}
              {allowedLanguages.length > 1 && !readOnly && (
                <div className="relative">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm font-medium text-gray-900 transition-all hover:border-teal-500/50 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
                  >
                    {allowedLanguages.map((lang) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang] || lang}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-all hover:border-teal-500/50 hover:text-gray-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-white"
                  title="Configuración"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 z-50 mt-2 w-52 rounded-lg border border-gray-200 bg-white p-3 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900 dark:shadow-black/60">
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-slate-400">
                          Tamaño de fuente
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="10"
                            max="24"
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 accent-teal-500 dark:bg-slate-700"
                          />
                          <span className="w-10 text-right text-sm font-semibold text-gray-900 dark:text-white">
                            {fontSize}px
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={toggleFullscreen}
                className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-all hover:border-teal-500/50 hover:text-gray-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-white"
                title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs (mobile only — desktop shows two-column layout) */}
        <div className="flex border-t border-gray-200 bg-gray-50 md:hidden dark:border-slate-800/50 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('problem')}
            className={`relative flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'problem'
                ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
            }`}
          >
            Descripción
            {activeTab === 'problem' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`relative flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'results'
                ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
            }`}
          >
            Resultados
            {testResults && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                passedTests === totalTests
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/20 text-red-600 dark:text-red-400'
              }`}>
                {passedTests}/{totalTests}
              </span>
            )}
            {activeTab === 'results' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`relative flex-1 px-4 py-3 text-sm font-medium transition-all ${
              activeTab === 'custom'
                ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
            }`}
          >
            {customInputLabel}
            {activeTab === 'custom' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
            )}
          </button>
        </div>
      </div>

      {/* ── Two-column layout: description left (desktop), editor+output right ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL: Problem description — always visible on desktop */}
        <div
          className="hidden shrink-0 flex-col overflow-hidden md:flex md:w-[var(--problem-width)]"
          style={{ '--problem-width': `${problemWidth}%` } as CSSProperties}
        >
          <div className="flex-none border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-slate-800/50 dark:bg-slate-900/30">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-slate-400">
              Descripción del problema
            </span>
          </div>
          <div className="flex-1 overflow-y-auto bg-white px-5 py-5 dark:bg-slate-900/20">
            <MarkdownContent content={questionText} isDark={isDark} />
          </div>
        </div>

        <div
          role="separator"
          aria-label="Ajustar ancho de la descripción"
          aria-orientation="vertical"
          aria-valuemin={22}
          aria-valuemax={40}
          aria-valuenow={Math.round(problemWidth)}
          tabIndex={0}
          onKeyDown={(event) => handlePanelResizeKeyDown(event, 'problem')}
          onPointerDown={(event) => startPanelResize(event, 'problem')}
          className="group hidden w-1 shrink-0 touch-none cursor-col-resize items-center justify-center bg-zinc-100 transition-colors hover:bg-teal-100 md:flex dark:bg-slate-800 dark:hover:bg-teal-950"
        >
          <span className="h-10 w-px bg-zinc-300 transition-colors group-hover:bg-teal-500 dark:bg-slate-600" />
        </div>

        {/* RIGHT PANEL: Editor + output (full width on mobile, 60% on desktop) */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">

          {/* Mobile 'problem' tab: compact description strip above editor */}
          {activeTab === 'problem' && (
            <div
              className="flex-none overflow-y-auto border-b border-gray-200 bg-white px-5 py-4 md:hidden dark:border-slate-800/50 dark:bg-slate-900/30"
              style={{ maxHeight: '140px' }}
            >
              <MarkdownContent content={questionText} isDark={isDark} />
            </div>
          )}

          {/* Monaco editor — always on desktop; only on 'problem' tab on mobile */}
          <div className={`relative min-h-0 min-w-0 ${activeTab !== 'problem' ? 'hidden md:block md:flex-1' : 'flex-1'}`}>
            <MonacoEditor
              height="100%"
              language={monacoLanguages[selectedLanguage] || 'javascript'}
              value={code}
              onChange={(value) => setCode(value || '')}
              onMount={handleEditorDidMount}
              theme={getIsDark() ? 'vs-dark' : 'vs'}
              options={{
                minimap: { enabled: true, scale: 1 },
                fontSize,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly,
                automaticLayout: true,
                padding: { top: 20, bottom: 20 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                wordWrap: 'on',
                fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                fontLigatures: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                renderLineHighlight: 'all',
              }}
            />
          </div>

          <div
            role="separator"
            aria-label="Ajustar ancho de resultados"
            aria-orientation="vertical"
            aria-valuemin={22}
            aria-valuemax={38}
            aria-valuenow={Math.round(outputWidth)}
            tabIndex={0}
            onKeyDown={(event) => handlePanelResizeKeyDown(event, 'output')}
            onPointerDown={(event) => startPanelResize(event, 'output')}
            className="group hidden w-1 shrink-0 touch-none cursor-col-resize items-center justify-center bg-zinc-100 transition-colors hover:bg-teal-100 md:flex dark:bg-slate-800 dark:hover:bg-teal-950"
          >
            <span className="h-10 w-px bg-zinc-300 transition-colors group-hover:bg-teal-500 dark:bg-slate-600" />
          </div>

          {/* Output panel — desktop: fixed height at bottom; mobile: full height for results/custom tabs */}
          <div
            style={{ '--output-width': `${outputWidth}%` } as CSSProperties}
            className={`min-h-0 w-full flex-col border-t border-gray-200 md:flex md:h-auto md:w-[var(--output-width)] md:flex-none md:border-t-0 dark:border-slate-800/50 ${
              activeTab === 'custom' || activeTab === 'results'
                ? 'flex flex-1'
                : 'hidden'
            }`}
          >

            {/* Desktop output sub-tabs */}
            <div className="hidden flex-none border-b border-gray-200 bg-gray-50 md:flex dark:border-slate-800/50 dark:bg-slate-900/30">
              <button
                onClick={() => setActiveTab('results')}
                className={`relative flex-1 px-5 py-2 text-xs font-semibold transition-all ${
                  activeTab !== 'custom'
                    ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
                }`}
              >
                Resultados
                {testResults && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    passedTests === totalTests
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {passedTests}/{totalTests}
                  </span>
                )}
                {activeTab !== 'custom' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                title="Prueba escenarios propios sin afectar tu calificación"
                className={`relative flex-1 px-5 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'custom'
                    ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
                }`}
              >
                {customInputLabel}
                {activeTab === 'custom' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
                )}
              </button>
            </div>

            {/* Output content (shared between mobile tabs and desktop output panel) */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeTab === 'custom' ? (
                /* Custom Input Panel */
                <div className="flex min-h-full flex-col gap-4 bg-gray-50 p-4 dark:bg-slate-900/20 sm:p-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-300">
                      {selectedLanguage === 'sql' ? 'Dataset SQL personalizado' : 'Input / Runner personalizado'}
                    </label>
                    <p className="mb-3 text-xs text-gray-500 dark:text-slate-400">
                      {selectedLanguage === 'sql' ? (
                        <>Define tablas y datos para probar tu consulta. No modifica los tests oficiales ni tu calificación.</>
                      ) : (
                        <>
                          Para JS/TS: escribe el código runner que llama tu función (ej:{' '}
                          <code className="rounded bg-gray-200 px-1 dark:bg-slate-800">console.log(solution(42))</code>).
                          Para otros lenguajes: escribe el stdin que recibirá tu programa. Esta prueba no envía tu solución ni afecta el puntaje.
                        </>
                      )}
                    </p>
                    <textarea
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={selectedLanguage === 'sql'
                        ? "CREATE TABLE usuarios (id INTEGER, nombre TEXT);\nINSERT INTO usuarios VALUES (1, 'Ana');"
                        : "// Ej: console.log(solution([1,2,3], 5))"}
                      rows={6}
                      className="min-h-32 w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={handleRunCustom}
                    disabled={isRunningCustom || !code.trim() || readOnly}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/50"
                  >
                    {isRunningCustom ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /><span>Ejecutando...</span></>
                    ) : (
                      <><Play className="h-4 w-4" /><span>{selectedLanguage === 'sql' ? 'Ejecutar con estos datos' : 'Ejecutar con este input'}</span></>
                    )}
                  </button>
                  {customOutput && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/50">
                      {customOutput.executionTimeMs && (
                        <div className="mb-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{customOutput.executionTimeMs}ms</span>
                        </div>
                      )}
                      {customOutput.output && (
                        <div className="mb-3">
                          <p className="mb-1 text-xs font-semibold text-gray-600 dark:text-slate-400">Output:</p>
                          <pre className="overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs font-mono text-gray-800 dark:bg-slate-800 dark:text-slate-200">{customOutput.output}</pre>
                        </div>
                      )}
                      {customOutput.error && (
                        <div>
                          <p className="mb-1 text-xs font-semibold text-red-600 dark:text-red-400">Error:</p>
                          <pre className="overflow-x-auto rounded-lg bg-red-50 p-3 text-xs font-mono text-red-700 dark:bg-red-900/20 dark:text-red-300">{customOutput.error}</pre>
                        </div>
                      )}
                      {!customOutput.output && !customOutput.error && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">Sin output</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Results Panel */
                <div className="bg-gray-50 p-5 dark:bg-slate-900/20">
                  {!testResults && !error && (
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <Terminal className="mb-3 h-10 w-10 text-teal-500/50 dark:text-teal-400/50" />
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Sin resultados aún</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                        Ejecuta los tests para ver los resultados
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/5">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-red-100 p-2 dark:bg-red-500/10">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="flex-1">
                          <p className="mb-1 text-sm font-semibold text-red-700 dark:text-red-400">Error de Ejecución</p>
                          <p className="text-xs text-red-600 dark:text-red-300/90">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {testResults && testResults.length > 0 && (
                    <div className="space-y-3">
                      {(() => {
                        const publicResults = testResults.filter((r) => !r.hidden);
                        const hiddenResults = testResults.filter((r) => r.hidden);
                        const publicPassed = publicResults.filter((r) => r.passed).length;
                        const hiddenPassed = hiddenResults.filter((r) => r.passed).length;
                        const allOk = passedTests === totalTests;
                        return (
                          <div className={`rounded-xl border p-4 ${allOk ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`rounded-lg p-2 ${allOk ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                                {allOk ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${allOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                  {allOk ? '¡Todos los tests pasaron!' : 'Algunos tests fallaron'}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-slate-400">
                                  <span>Públicos: <strong>{publicPassed}/{publicResults.length}</strong></span>
                                  {hiddenResults.length > 0 && (
                                    <span>Ocultos: <strong>{hiddenPassed}/{hiddenResults.length}</strong></span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {testResults.map((result, idx) => {
                        const isHidden = Boolean(result.hidden);
                        const showDetails =
                          !isHidden &&
                          isNonEmptyString(result.input) &&
                          isNonEmptyString(result.expectedOutput);
                        return (
                          <div
                            key={result.testCaseId}
                            className={`rounded-xl border p-3 ${
                              result.passed
                                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5'
                                : 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/5'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex flex-1 items-start gap-2">
                                <div className={`rounded-lg p-1 ${result.passed ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                                  {result.passed ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-semibold ${result.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                    Test {idx + 1} {result.passed ? 'Pasó' : 'Falló'}
                                    {isHidden && <span className="ml-2 text-xs opacity-60">(Oculto)</span>}
                                  </p>
                                  {showDetails && (
                                    <div className="mt-1 space-y-1 text-xs">
                                      <div>
                                        <span className="font-medium text-gray-600 dark:text-slate-400">Input: </span>
                                        <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-800 dark:bg-slate-800/80 dark:text-slate-200">
                                          {formatInputDisplay(result.input || '', selectedLanguage)}
                                        </code>
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-600 dark:text-slate-400">Expected: </span>
                                        <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-gray-800 dark:bg-slate-800/80 dark:text-slate-200">
                                          {result.expectedOutput}
                                        </code>
                                      </div>
                                      {isNonEmptyString(result.actualOutput) && (
                                        <div>
                                          <span className="font-medium text-gray-600 dark:text-slate-400">Actual: </span>
                                          <code className={`rounded px-1.5 py-0.5 font-mono ${result.passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'}`}>
                                            {result.actualOutput}
                                          </code>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {result.error && (
                                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 dark:border-red-500/20 dark:bg-red-500/10">
                                      <p className="text-xs font-mono text-red-700 dark:text-red-300">{result.error}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {result.executionTimeMs !== undefined && (
                                <div className="flex items-center gap-1 rounded-lg bg-gray-200 px-2 py-1 text-xs text-gray-600 dark:bg-slate-800/50 dark:text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  <span>{result.executionTimeMs}ms</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions - mobile y tablet */}
      {!readOnly && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 lg:hidden dark:border-slate-800/50 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="hidden items-center gap-2 text-xs font-medium text-gray-600 sm:flex dark:text-slate-400">
              <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Ctrl/Cmd
              </kbd>
              +
              <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Enter
              </kbd>
              <span>para ejecutar tests</span>
            </p>

            {renderPrimaryActions(false)}
          </div>
        </div>
      )}
    </div>
  );
}