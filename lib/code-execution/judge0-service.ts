// lib/code-execution/judge0-service.ts
/**
 * Judge0 Code Execution Service
 * 
 * Handles secure code execution using Judge0 API (https://judge0.com/)
 * 
 * Alternative: Deploy your own Judge0 instance via Docker:
 * https://github.com/judge0/judge0
 */

interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'COMPILATION_ERROR' | 'RUNTIME_ERROR' | 'MEMORY_LIMIT';
  executionTimeMs?: number;
  memoryUsedMb?: number;
  testResults?: TestResult[];
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  error?: string;
  executionTimeMs?: number;
}

interface CodeSubmission {
  code: string;
  language: string;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    timeoutMs?: number;
    memoryLimitMb?: number;
  }>;
}

// Language ID mapping for Judge0
const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,   // Node.js
  typescript: 74,   // TypeScript
  python: 71,       // Python 3
  java: 62,         // Java
  cpp: 54,          // C++ (GCC 9.2.0)
  c: 50,            // C (GCC 9.2.0)
  csharp: 51,       // C#
  go: 60,           // Go
  rust: 73,         // Rust
  ruby: 72,         // Ruby
  php: 68,          // PHP
  swift: 83,        // Swift
  kotlin: 78,       // Kotlin
};

export class Judge0Service {
  private apiUrl: string;
  private apiKey?: string;
  private rapidApiHost?: string;

  constructor() {
    // Option 1: Use Judge0 RapidAPI (easiest, has free tier)
    // https://rapidapi.com/judge0-official/api/judge0-ce
    this.apiUrl = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
    this.apiKey = process.env.JUDGE0_API_KEY || process.env.RAPIDAPI_KEY;
    this.rapidApiHost = process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';

    // Option 2: Self-hosted Judge0
    // this.apiUrl = process.env.JUDGE0_API_URL || 'http://localhost:2358';
  }

  /**
   * Execute code against multiple test cases
   */
  async executeCode(submission: CodeSubmission): Promise<ExecutionResult> {
    try {
      const languageId = LANGUAGE_IDS[submission.language];
      
      if (!languageId) {
        return {
          success: false,
          status: 'ERROR',
          error: `Unsupported language: ${submission.language}`,
        };
      }

      // Execute all test cases
      const testResults: TestResult[] = [];
      let totalTime = 0;
      let maxMemory = 0;

      for (const testCase of submission.testCases) {
        const result = await this.executeTestCase(
          submission.code,
          languageId,
          testCase.input,
          testCase.expectedOutput,
          testCase.timeoutMs,
          testCase.memoryLimitMb
        );

        testResults.push({
          testCaseId: testCase.id,
          passed: result.passed,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: result.output,
          error: result.error,
          executionTimeMs: result.executionTimeMs,
        });

        if (result.executionTimeMs) {
          totalTime += result.executionTimeMs;
        }

        if (result.memoryUsedMb && result.memoryUsedMb > maxMemory) {
          maxMemory = result.memoryUsedMb;
        }

        // Stop on first failure for efficiency (optional)
        // if (!result.passed) break;
      }

      const allPassed = testResults.every(r => r.passed);
      const hasErrors = testResults.some(r => r.error);

      return {
        success: allPassed,
        status: allPassed ? 'SUCCESS' : (hasErrors ? 'RUNTIME_ERROR' : 'ERROR'),
        output: testResults.map(r => r.actualOutput).join('\n---\n'),
        testResults,
        executionTimeMs: totalTime,
        memoryUsedMb: maxMemory,
      };

    } catch (error) {
      console.error('[Judge0Service] Execution error:', error);
      return {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(
    code: string,
    languageId: number,
    input: string,
    expectedOutput: string,
    timeoutMs = 5000,
    memoryLimitMb = 256
  ): Promise<{
    passed: boolean;
    output?: string;
    error?: string;
    executionTimeMs?: number;
    memoryUsedMb?: number;
  }> {
    try {
      // Create submission
      const submissionResponse = await this.createSubmission({
        source_code: code,
        language_id: languageId,
        stdin: input,
        expected_output: expectedOutput,
        cpu_time_limit: timeoutMs / 1000, // Convert to seconds
        memory_limit: memoryLimitMb * 1024, // Convert to KB
      });

      if (!submissionResponse.ok) {
        const errorData = await submissionResponse.json();
        throw new Error(`Judge0 API error: ${JSON.stringify(errorData)}`);
      }

      const { token } = await submissionResponse.json();

      // Poll for result
      const result = await this.pollSubmissionResult(token);
      
      return {
        passed: result.status.id === 3,
        output: result.stdout ? Buffer.from(result.stdout, 'base64').toString('utf-8') : (result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf-8') : ''),
        error: result.compile_output ? Buffer.from(result.compile_output, 'base64').toString('utf-8') : (result.stderr ? Buffer.from(result.stderr, 'base64').toString('utf-8') : (result.status.id !== 3 ? result.status.description : undefined)),
        executionTimeMs: result.time ? parseFloat(result.time) * 1000 : undefined,
        memoryUsedMb: result.memory ? result.memory / 1024 : undefined,
        };

    } catch (error) {
      console.error('[Judge0Service] Test case execution error:', error);
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }

  /**
   * Create submission in Judge0
   */
  private async createSubmission(data: any): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add RapidAPI headers if using RapidAPI
    if (this.apiKey && this.rapidApiHost) {
      headers['X-RapidAPI-Key'] = this.apiKey;
      headers['X-RapidAPI-Host'] = this.rapidApiHost;
    }

      // 🔍 DEBUG - agregar estos logs
    console.log('[Judge0] Creating submission with data:', JSON.stringify(data, null, 2));
    console.log('[Judge0] API URL:', `${this.apiUrl}/submissions?wait=false`);
    console.log('[Judge0] Headers:', headers);

    return fetch(`${this.apiUrl}/submissions?wait=false`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
  }

    /**
     * Poll for submission result
     */
    private async pollSubmissionResult(token: string, maxAttempts = 20): Promise<any> {
    const headers: HeadersInit = {};

    if (this.apiKey && this.rapidApiHost) {
        headers['X-RapidAPI-Key'] = this.apiKey;
        headers['X-RapidAPI-Host'] = this.rapidApiHost;
    }

    for (let i = 0; i < maxAttempts; i++) {
        // CRITICAL: Must include base64_encoded=false for RapidAPI
        const url = `${this.apiUrl}/submissions/${token}?base64_encoded=true&fields=*`;
        console.log('[Judge0] Polling attempt', i + 1, 'URL:', url);
        
        const response = await fetch(url, { headers });

        if (!response.ok) {
        const errorText = await response.text();
        console.error('[Judge0] Poll failed:', response.status, errorText);
        throw new Error(`Failed to get submission result: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('[Judge0] Got result, status:', result.status);

        // Status 1 = In Queue, 2 = Processing
        if (result.status.id > 2) {
        return result;
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Execution timeout - polling exceeded max attempts');
    }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_IDS);
  }

  /**
   * Validate language support
   */
  isLanguageSupported(language: string): boolean {
    return language in LANGUAGE_IDS;
  }

  /**
   * Get language display name
   */
  getLanguageDisplayName(language: string): string {
    const names: Record<string, string> = {
      javascript: 'JavaScript (Node.js)',
      typescript: 'TypeScript',
      python: 'Python 3',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust',
      ruby: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
    };

    return names[language] || language;
  }

  /**
   * Get starter code template for a language
   */
  getStarterCode(language: string, functionName = 'solution'): string {
    const templates: Record<string, string> = {
      javascript: `function ${functionName}(input) {
  // Tu código aquí
  
  return result;
}

// No modifiques esta línea
console.log(${functionName}(require('fs').readFileSync(0, 'utf-8').trim()));`,

      python: `def ${functionName}(input_data):
    # Tu código aquí
    
    return result

# No modifiques esta línea
if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read().strip()
    print(${functionName}(input_data))`,

      java: `import java.util.*;

public class Main {
    public static String ${functionName}(String input) {
        // Tu código aquí
        
        return result;
    }
    
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String input = scanner.nextLine();
        System.out.println(${functionName}(input));
    }
}`,

      cpp: `#include <iostream>
#include <string>
using namespace std;

string ${functionName}(string input) {
    // Tu código aquí
    
    return result;
}

int main() {
    string input;
    getline(cin, input);
    cout << ${functionName}(input) << endl;
    return 0;
}`,
    };

    return templates[language] || `// Starter code for ${language}\n// Write your solution here`;
  }
}

// Export singleton instance
export const judge0Service = new Judge0Service();