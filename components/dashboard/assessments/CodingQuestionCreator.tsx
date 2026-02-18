// components/dashboard/assessments/CodingQuestionCreator.tsx
'use client';

import { useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Code2, Save, Loader2 } from 'lucide-react';

interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  timeoutMs: number;
  memoryLimitMb: number;
}

interface CodingQuestionData {
  text: string;
  points: number;
  language: string;
  allowedLanguages: string[];
  starterCode: string;
  solutionCode: string;
  testCases: TestCase[];
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
];

const STARTER_TEMPLATES: Record<string, string> = {
  javascript: `function solution(input) {
  // Tu código aquí
  
  return result;
}

// No modifiques esta línea
console.log(solution(require('fs').readFileSync(0, 'utf-8').trim()));`,
  
  python: `def solution(input_data):
    # Tu código aquí
    
    return result

if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read().strip()
    print(solution(input_data))`,
  
  java: `import java.util.*;

public class Main {
    public static String solution(String input) {
        // Tu código aquí
        
        return result;
    }
    
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String input = scanner.nextLine();
        System.out.println(solution(input));
    }
}`,
};

export default function CodingQuestionCreator({
  onSave,
  initialData,
}: {
  onSave: (data: CodingQuestionData) => Promise<void>;
  initialData?: Partial<CodingQuestionData>;
}) {
  const [question, setQuestion] = useState<CodingQuestionData>({
    text: initialData?.text || '',
    points: initialData?.points || 10,
    language: initialData?.language || 'javascript',
    allowedLanguages: initialData?.allowedLanguages || ['javascript', 'python', 'java'],
    starterCode: initialData?.starterCode || STARTER_TEMPLATES.javascript,
    solutionCode: initialData?.solutionCode || '',
    testCases: initialData?.testCases || [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTestCase = () => {
    const newTestCase: TestCase = {
      id: `test-${Date.now()}-${Math.random()}`,
      input: '',
      expectedOutput: '',
      isHidden: false,
      points: 1,
      timeoutMs: 5000,
      memoryLimitMb: 256,
    };

    setQuestion(prev => ({
      ...prev,
      testCases: [...prev.testCases, newTestCase],
    }));
  };

  const removeTestCase = (id: string) => {
    setQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.filter(tc => tc.id !== id),
    }));
  };

  const updateTestCase = (id: string, updates: Partial<TestCase>) => {
    setQuestion(prev => ({
      ...prev,
      testCases: prev.testCases.map(tc =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    }));
  };

  const handleLanguageChange = (newLang: string) => {
    setQuestion(prev => ({
      ...prev,
      language: newLang,
      starterCode: STARTER_TEMPLATES[newLang] || prev.starterCode,
    }));
  };

  const handleSave = async () => {
    setError(null);

    // Validations
    if (!question.text.trim()) {
      setError('La descripción de la pregunta es requerida');
      return;
    }

    if (question.testCases.length === 0) {
      setError('Debes agregar al menos un test case');
      return;
    }

    if (question.testCases.every(tc => tc.isHidden)) {
      setError('Debe haber al menos un test case visible para el candidato');
      return;
    }

    // Check that all test cases have input and output
    const invalidTests = question.testCases.filter(
      tc => !tc.input.trim() || !tc.expectedOutput.trim()
    );

    if (invalidTests.length > 0) {
      setError('Todos los test cases deben tener input y output');
      return;
    }

    setIsSaving(true);

    try {
      await onSave(question);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Question Text */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-300">
          Descripción del Problema *
        </label>
        <textarea
          value={question.text}
          onChange={(e) => setQuestion(prev => ({ ...prev, text: e.target.value }))}
          placeholder="Describe el problema que el candidato debe resolver..."
          rows={6}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Puedes usar Markdown para formatear el texto
        </p>
      </div>

      {/* Points */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-300">
          Puntos *
        </label>
        <input
          type="number"
          min={1}
          value={question.points}
          onChange={(e) => setQuestion(prev => ({ ...prev, points: parseInt(e.target.value) || 1 }))}
          className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {/* Language Selection */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-300">
            Lenguaje Principal *
          </label>
          <select
            value={question.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-zinc-300">
            Lenguajes Permitidos *
          </label>
          <div className="space-y-2">
            {SUPPORTED_LANGUAGES.map(lang => (
              <label key={lang.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={question.allowedLanguages.includes(lang.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setQuestion(prev => ({
                        ...prev,
                        allowedLanguages: [...prev.allowedLanguages, lang.value],
                      }));
                    } else {
                      setQuestion(prev => ({
                        ...prev,
                        allowedLanguages: prev.allowedLanguages.filter(l => l !== lang.value),
                      }));
                    }
                  }}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-700 text-violet-600 focus:ring-2 focus:ring-violet-500/20"
                />
                <span className="text-sm text-zinc-300">{lang.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Starter Code */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-300">
          Código Inicial (Starter Code)
        </label>
        <textarea
          value={question.starterCode}
          onChange={(e) => setQuestion(prev => ({ ...prev, starterCode: e.target.value }))}
          placeholder="Código que verá el candidato al inicio..."
          rows={8}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {/* Solution Code */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-zinc-300">
          Solución de Referencia (Opcional)
        </label>
        <textarea
          value={question.solutionCode}
          onChange={(e) => setQuestion(prev => ({ ...prev, solutionCode: e.target.value }))}
          placeholder="Tu solución de referencia (solo tú podrás verla)..."
          rows={8}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />
      </div>

      {/* Test Cases */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Test Cases</h3>
            <p className="text-sm text-zinc-400">
              Agrega casos de prueba para validar las soluciones
            </p>
          </div>
          <button
            onClick={addTestCase}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Agregar Test
          </button>
        </div>

        <div className="space-y-4">
          {question.testCases.map((testCase, idx) => (
            <div
              key={testCase.id}
              className="rounded-lg border border-zinc-700 bg-zinc-800 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-violet-400" />
                  <span className="font-semibold text-white">Test Case {idx + 1}</span>
                  {testCase.isHidden && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      Oculto
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeTestCase(testCase.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">
                    Input *
                  </label>
                  <textarea
                    value={testCase.input}
                    onChange={(e) => updateTestCase(testCase.id, { input: e.target.value })}
                    placeholder="Input del test..."
                    rows={3}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">
                    Output Esperado *
                  </label>
                  <textarea
                    value={testCase.expectedOutput}
                    onChange={(e) => updateTestCase(testCase.id, { expectedOutput: e.target.value })}
                    placeholder="Output esperado..."
                    rows={3}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">
                    Puntos
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={testCase.points}
                    onChange={(e) => updateTestCase(testCase.id, { points: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={testCase.timeoutMs}
                    onChange={(e) => updateTestCase(testCase.id, { timeoutMs: parseInt(e.target.value) || 5000 })}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-400">
                    Memory (MB)
                  </label>
                  <input
                    type="number"
                    min={64}
                    step={64}
                    value={testCase.memoryLimitMb}
                    onChange={(e) => updateTestCase(testCase.id, { memoryLimitMb: parseInt(e.target.value) || 256 })}
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => updateTestCase(testCase.id, { isHidden: !testCase.isHidden })}
                    className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      testCase.isHidden
                        ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                  >
                    {testCase.isHidden ? (
                      <>
                        <EyeOff className="h-4 w-4" /> Oculto
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" /> Visible
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {question.testCases.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-zinc-700 p-8 text-center">
              <Code2 className="mx-auto h-12 w-12 text-zinc-600" />
              <p className="mt-2 text-sm font-semibold text-zinc-400">
                No hay test cases
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Agrega al menos un test case para validar las soluciones
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end border-t border-zinc-700 pt-6">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Guardar Pregunta
            </>
          )}
        </button>
      </div>
    </div>
  );
}