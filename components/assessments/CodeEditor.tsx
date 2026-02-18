// components/assessments/CodeEditor.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950">
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping">
            <Code2 className="h-12 w-12 text-violet-500/30 mx-auto" />
          </div>
          <Code2 className="relative h-12 w-12 text-violet-500 mx-auto mb-4" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-violet-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-300">Cargando editor de código...</p>
        <p className="text-xs text-slate-500 mt-1">Preparando el entorno</p>
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

    if (!confirm('¿Estás seguro de enviar tu solución? No podrás modificarla después.')) return;

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
      className="flex h-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 rounded-2xl overflow-hidden border border-slate-800/50 shadow-2xl"
    >
      {/* Header Professional */}
      <div className="border-b border-slate-800/80 bg-gradient-to-r from-slate-900 to-slate-800/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Title & Points */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl blur-lg opacity-30"></div>
                <div className="relative rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-3">
                  <Code2 className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Pregunta de Código</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-sm font-medium text-violet-400">
                    <Zap className="h-3.5 w-3.5" />
                    {points} puntos
                  </span>
                  {testResults && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                      passedTests === totalTests
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    }`}>
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

            {/* Right: Language selector & Controls */}
            <div className="flex items-center gap-3">
              {allowedLanguages.length > 1 && !readOnly && (
                <div className="relative">
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="appearance-none rounded-lg border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm px-4 py-2 pr-10 text-sm font-medium text-white transition-all hover:border-violet-500/50 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {allowedLanguages.map((lang) => (
                      <option key={lang} value={lang}>
                        {languageNames[lang] || lang}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              )}

              {/* Settings */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-white hover:border-violet-500/50 transition-all"
                  title="Configuración"
                >
                  <Settings className="h-4 w-4" />
                </button>
                
                {showSettings && (
                  <div className="absolute right-0 mt-2 p-4 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl min-w-[240px] z-50">
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-400 block mb-2">
                          Tamaño de fuente
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="10"
                            max="24"
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                          />
                          <span className="text-sm font-semibold text-white w-10 text-right">{fontSize}px</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-slate-400 hover:text-white hover:border-violet-500/50 transition-all"
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
        <div className="flex border-t border-slate-800/50 bg-slate-900/30">
          <button
            onClick={() => setActiveTab('problem')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'problem'
                ? 'text-white bg-slate-800/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
            }`}
          >
            Descripción del Problema
            {activeTab === 'problem' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-all relative ${
              activeTab === 'results'
                ? 'text-white bg-slate-800/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
            }`}
          >
            Resultados de Tests
            {testResults && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                passedTests === totalTests
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
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
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'problem' ? (
          <>
            {/* Problem Description */}
            <div className="border-b border-slate-800/50 bg-slate-900/30 px-6 py-5 max-h-48 overflow-y-auto">
              <div 
                className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-code:text-violet-400 prose-code:bg-violet-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded" 
                dangerouslySetInnerHTML={{ __html: questionText }} 
              />
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 relative">
              <MonacoEditor
                height="100%"
                language={monacoLanguages[selectedLanguage] || 'javascript'}
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true, scale: 1 },
                  fontSize: fontSize,
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
          <div className="flex-1 overflow-y-auto bg-slate-900/20 p-6">
            {!testResults && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-violet-600/20 rounded-full blur-2xl"></div>
                  <Terminal className="relative h-16 w-16 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sin resultados aún</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Ejecuta los tests para ver los resultados de tu código
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-400 mb-1">Error de Ejecución</p>
                    <p className="text-sm text-red-300/90">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {testResults && testResults.length > 0 && (
              <div className="space-y-4">
                {/* Summary Card */}
                <div className={`rounded-xl border p-5 backdrop-blur-sm ${
                  passedTests === totalTests
                    ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
                    : 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-red-500/5'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${
                      passedTests === totalTests
                        ? 'bg-emerald-500/20'
                        : 'bg-red-500/20'
                    }`}>
                      {passedTests === totalTests ? (
                        <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                      ) : (
                        <XCircle className="h-7 w-7 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-lg font-bold ${
                        passedTests === totalTests
                          ? 'text-emerald-400'
                          : 'text-red-400'
                      }`}>
                        {passedTests === totalTests ? '¡Excelente! Todos los tests pasaron' : 'Algunos tests fallaron'}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        {passedTests} de {totalTests} tests pasados
                      </p>
                    </div>
                  </div>
                </div>

                {/* Individual Test Results */}
                {testResults.map((result, idx) => {
                  const isHidden = Boolean(result.hidden);
                  const showDetails =
                    !isHidden && isNonEmptyString(result.input) && isNonEmptyString(result.expectedOutput);

                  return (
                    <div
                      key={result.testCaseId}
                      className={`rounded-xl border p-4 backdrop-blur-sm transition-all hover:scale-[1.01] ${
                        result.passed 
                          ? 'border-emerald-500/30 bg-emerald-500/5' 
                          : 'border-red-500/30 bg-red-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-1.5 rounded-lg ${
                            result.passed ? 'bg-emerald-500/20' : 'bg-red-500/20'
                          }`}>
                            {result.passed ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-400" />
                            )}
                          </div>

                          <div className="flex-1">
                            <p className={`font-semibold mb-2 ${
                              result.passed ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              Test {idx + 1} {result.passed ? 'Pasó' : 'Falló'}
                              {isHidden && <span className="ml-2 text-xs opacity-60">(Oculto)</span>}
                            </p>

                            {showDetails && (
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-slate-400">Input: </span>
                                  <code className="rounded-lg bg-slate-800/80 px-2 py-1 font-mono text-slate-200 text-xs">
                                    {result.input}
                                  </code>
                                </div>
                                <div>
                                  <span className="font-medium text-slate-400">Expected: </span>
                                  <code className="rounded-lg bg-slate-800/80 px-2 py-1 font-mono text-slate-200 text-xs">
                                    {result.expectedOutput}
                                  </code>
                                </div>
                                {isNonEmptyString(result.actualOutput) && (
                                  <div>
                                    <span className="font-medium text-slate-400">Actual: </span>
                                    <code className={`rounded-lg px-2 py-1 font-mono text-xs ${
                                      result.passed
                                        ? 'bg-emerald-500/20 text-emerald-200'
                                        : 'bg-red-500/20 text-red-200'
                                    }`}>
                                      {result.actualOutput}
                                    </code>
                                  </div>
                                )}
                              </div>
                            )}

                            {result.error && (
                              <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                                <p className="text-xs font-mono text-red-300">{result.error}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {result.executionTimeMs !== undefined && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 text-xs text-slate-400">
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
        <div className="border-t border-slate-800/50 bg-gradient-to-r from-slate-900 to-slate-800/50 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                Ctrl/Cmd
              </kbd>
              +
              <kbd className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
                Enter
              </kbd>
              <span>para ejecutar tests</span>
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleRunTests}
                disabled={isRunning || isSubmitting || !code.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 border border-slate-700/50 shadow-lg hover:shadow-violet-500/20"
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
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 px-5 py-2.5 text-sm font-bold text-white shadow-xl shadow-violet-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
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