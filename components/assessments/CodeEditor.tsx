// components/assessments/CodeEditor.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
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
            <Code2 className="mx-auto h-12 w-12 text-violet-500/30" />
          </div>
          <Code2 className="relative mx-auto mb-4 h-12 w-12 text-violet-500" />
        </div>
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-violet-500 dark:text-violet-400" />
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
function formatInputDisplay(input: string): string {
  if (!input) return input;
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
            <code className="rounded bg-violet-500/10 px-1.5 py-0.5 text-xs font-mono text-violet-700 dark:text-violet-400">
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
          <blockquote className="mb-2 border-l-4 border-violet-400 pl-3 text-sm italic text-gray-500 dark:text-slate-400">
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
  const [activeTab, setActiveTab] = useState<'problem' | 'results'>('problem');
  // ✅ NUEVO: trackear si ejecutó tests antes de enviar
  const [hasRunTests, setHasRunTests] = useState(false);

  const editorRef = useRef<any>(null);
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
  };

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
    } catch (err) {
      console.error('Error running tests:', err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isRunning || readOnly) return;
    if (!code.trim()) return;

    // ✅ Advertir si no ha ejecutado tests
    if (!hasRunTests) {
      const proceed = confirm(
        '⚠️ No has ejecutado los tests todavía.\n¿Seguro que quieres enviar sin probar tu solución?'
      );
      if (!proceed) return;
    } else {
      if (!confirm('¿Estás seguro de enviar tu solución? No podrás modificarla después.')) return;
    }
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

      onSubmit?.(code, selectedLanguage);
    } catch (err) {
      console.error('Error submitting code:', err);
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

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

  const passedTests = testResults?.filter((r) => r.passed).length || 0;
  const totalTests = testResults?.length || 0;

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl dark:border-slate-800/50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950 dark:text-white"
    >
      {/* Header */}
      <div className="border-b border-gray-200 bg-white dark:border-slate-800/80 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800/50 dark:backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 opacity-30 blur-lg"></div>
                <div className="relative rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-3">
                  <Code2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Pregunta de Código
                </h3>
                <div className="mt-1 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-600 dark:text-violet-400">
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

            <div className="flex items-center gap-3">
              {allowedLanguages.length > 1 && !readOnly && (
                <div className="relative">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm font-medium text-gray-900 transition-all hover:border-violet-500/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-white"
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
                  className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-600 transition-all hover:border-violet-500/50 hover:text-gray-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-white"
                  title="Configuración"
                >
                  <Settings className="h-4 w-4" />
                </button>

                {showSettings && (
                  <div className="absolute right-0 z-50 mt-2 min-w-[240px] rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-slate-700/50 dark:bg-slate-900/95 dark:backdrop-blur-xl">
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
                            className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-300 accent-violet-500 dark:bg-slate-700"
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
                className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-600 transition-all hover:border-violet-500/50 hover:text-gray-900 dark:border-slate-700/50 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:text-white"
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

        {/* Tabs */}
        <div className="flex border-t border-gray-200 bg-gray-50 dark:border-slate-800/50 dark:bg-slate-900/30">
          <button
            onClick={() => setActiveTab('problem')}
            className={`relative flex-1 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === 'problem'
                ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
            }`}
          >
            Descripción del Problema
            {activeTab === 'problem' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`relative flex-1 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === 'results'
                ? 'bg-white text-gray-900 dark:bg-slate-800/50 dark:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800/30 dark:hover:text-white'
            }`}
          >
            Resultados de Tests
            {testResults && (
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  passedTests === totalTests
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/20 text-red-600 dark:text-red-400'
                }`}
              >
                {passedTests}/{totalTests}
              </span>
            )}
            {activeTab === 'results' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'problem' ? (
          <>
            {/* ✅ Problem Description — ahora con react-markdown */}
            <div className="max-h-48 overflow-y-auto border-b border-gray-200 bg-white px-6 py-5 dark:border-slate-800/50 dark:bg-slate-900/30">
              <MarkdownContent content={questionText} isDark={isDark} />
            </div>

            {/* Monaco Editor */}
            <div className="relative flex-1">
              <MonacoEditor
                height="100%"
                language={monacoLanguages[selectedLanguage] || 'javascript'}
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={handleEditorDidMount}
                theme={isDark ? 'vs-dark' : 'vs'}
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
          </>
        ) : (
          /* Results Panel */
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-slate-900/20">
            {!testResults && !error && (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-violet-600/20 blur-2xl"></div>
                  <Terminal className="relative h-16 w-16 text-violet-500 dark:text-violet-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                  Sin resultados aún
                </h3>
                <p className="max-w-md text-sm text-gray-600 dark:text-slate-400">
                  Ejecuta los tests para ver los resultados de tu código
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-5 dark:border-red-500/30 dark:bg-red-500/5 dark:backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-100 p-2 dark:bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 font-semibold text-red-700 dark:text-red-400">
                      Error de Ejecución
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300/90">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {testResults && testResults.length > 0 && (
              <div className="space-y-4">
                {/* Summary Card */}
                <div
                  className={`rounded-xl border p-5 ${
                    passedTests === totalTests
                      ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-emerald-500/5'
                      : 'border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 dark:border-red-500/30 dark:from-red-500/10 dark:to-red-500/5'
                  } dark:backdrop-blur-sm`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-xl p-3 ${
                        passedTests === totalTests
                          ? 'bg-emerald-100 dark:bg-emerald-500/20'
                          : 'bg-red-100 dark:bg-red-500/20'
                      }`}
                    >
                      {passedTests === totalTests ? (
                        <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-lg font-bold ${
                          passedTests === totalTests
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {passedTests === totalTests
                          ? '¡Excelente! Todos los tests pasaron'
                          : 'Algunos tests fallaron'}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                        {passedTests} de {totalTests} tests pasados
                      </p>
                    </div>
                  </div>
                </div>

                {/* Individual Test Results */}
                {testResults.map((result, idx) => {
                  const isHidden = Boolean(result.hidden);
                  const showDetails =
                    !isHidden &&
                    isNonEmptyString(result.input) &&
                    isNonEmptyString(result.expectedOutput);

                  return (
                    <div
                      key={result.testCaseId}
                      className={`rounded-xl border p-4 transition-all hover:scale-[1.01] ${
                        result.passed
                          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5'
                          : 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/5'
                      } dark:backdrop-blur-sm`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-1 items-start gap-3">
                          <div
                            className={`rounded-lg p-1.5 ${
                              result.passed
                                ? 'bg-emerald-100 dark:bg-emerald-500/20'
                                : 'bg-red-100 dark:bg-red-500/20'
                            }`}
                          >
                            {result.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            )}
                          </div>

                          <div className="flex-1">
                            <p
                              className={`mb-2 font-semibold ${
                                result.passed
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              Test {idx + 1} {result.passed ? 'Pasó' : 'Falló'}
                              {isHidden && (
                                <span className="ml-2 text-xs opacity-60">(Oculto)</span>
                              )}
                            </p>

                            {showDetails && (
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-gray-600 dark:text-slate-400">
                                    Input:{' '}
                                  </span>
                                  <code className="rounded-lg bg-gray-200 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-slate-800/80 dark:text-slate-200">
                                    {formatInputDisplay(result.input || '')}
                                  </code>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-600 dark:text-slate-400">
                                    Expected:{' '}
                                  </span>
                                  <code className="rounded-lg bg-gray-200 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-slate-800/80 dark:text-slate-200">
                                    {result.expectedOutput}
                                  </code>
                                </div>
                                {isNonEmptyString(result.actualOutput) && (
                                  <div>
                                    <span className="font-medium text-gray-600 dark:text-slate-400">
                                      Actual:{' '}
                                    </span>
                                    <code
                                      className={`rounded-lg px-2 py-1 font-mono text-xs ${
                                        result.passed
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                                          : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                                      }`}
                                    >
                                      {result.actualOutput}
                                    </code>
                                  </div>
                                )}
                              </div>
                            )}

                            {result.error && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-500/20 dark:bg-red-500/10">
                                <p className="text-xs font-mono text-red-700 dark:text-red-300">
                                  {result.error}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {result.executionTimeMs !== undefined && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:bg-slate-800/50 dark:text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="font-medium">{result.executionTimeMs}ms</span>
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

      {/* Footer Actions */}
      {!readOnly && (
        <div className="border-t border-gray-200 bg-white px-6 py-4 dark:border-slate-800/50 dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800/50 dark:backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-slate-400">
              <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Ctrl/Cmd
              </kbd>
              +
              <kbd className="rounded border border-gray-300 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Enter
              </kbd>
              <span>para ejecutar tests</span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleRunTests}
                disabled={isRunning || isSubmitting || !code.trim()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:bg-gray-700 disabled:opacity-50 disabled:hover:scale-100 dark:border-slate-700/50 dark:bg-slate-800 dark:hover:shadow-violet-500/20"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Ejecutando...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Ejecutar Tests</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSubmit}
                disabled={isRunning || isSubmitting || !code.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:scale-105 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Enviar Solución</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}