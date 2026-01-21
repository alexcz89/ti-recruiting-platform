# Testing Guide

## Running Tests

### Unit Tests (Server-side)
```bash
# Run all server tests
npm run test:unit

# Watch mode for development
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run with coverage + interactive UI
npm run test:coverage:ui
```

### Other Test Suites
```bash
# Integration tests
npm run test:integration

# Security tests
npm run test:security

# Performance benchmarks
npm run test:performance

# All tests
npm run test:all
```

## Coverage Reports

After running `npm run test:coverage`, you'll find:

- **Terminal output**: Summary in the console
- **HTML report**: Open `coverage/index.html` in your browser for detailed interactive report
- **JSON report**: `coverage/coverage-final.json` for CI/CD integration
- **LCOV report**: `coverage/lcov.info` for tools like Codecov or Coveralls

### Coverage Thresholds

Current thresholds (will fail if not met):
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

## Test Structure

```
__tests__/
├── server/           # Server-side unit tests
│   ├── rate-limit.test.ts
│   ├── api-response.test.ts
│   └── guards.test.ts
├── integration/      # Integration tests
├── security/         # Security tests
├── performance/      # Performance benchmarks
└── utils/           # Test utilities and helpers
```

## Writing Tests

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Use clear, descriptive test names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Dependencies**: Use `vi.mock()` for external services
5. **Fake Timers**: Use `vi.useFakeTimers()` for time-dependent tests
6. **Clean Up**: Always clean up in `afterEach` hooks

## CI/CD Integration

Tests run automatically on:
- Every push to main branch
- Every pull request
- Can be manually triggered from GitHub Actions

See `.github/workflows/test-workflow.yml` for configuration.

## Troubleshooting

### Tests failing locally but passing in CI
- Check Node.js version (use same as CI)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vitest cache: `npx vitest run --clearCache`

### Coverage not generating
- Ensure `@vitest/coverage-v8` is installed
- Check vitest.config.ts coverage configuration
- Run with verbose: `npm run test:coverage -- --reporter=verbose`

### Module resolution issues
- Check path aliases in vitest.config.ts
- Ensure tsconfig.json paths match vitest config
- Verify server-only mock is properly configured
