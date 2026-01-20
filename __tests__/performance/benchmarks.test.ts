// __tests__/performance/benchmarks.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkEmailRateLimit,
  checkIpRateLimit,
  resetEmailRateLimit,
} from '@/lib/server/rate-limit';
import {
  jsonSuccess,
  jsonError,
  badRequest,
  unauthorized,
} from '@/lib/server/api-response';
import { measurePerformance, generateTestData } from '../utils/test-helpers';

describe('Performance Benchmarks', () => {
  describe('Rate Limiting Performance', () => {
    it('should check email rate limits in <1ms on average', async () => {
      const email = generateTestData.email();
      
      const { averageTime } = await measurePerformance(
        () => checkEmailRateLimit(email),
        1000
      );

      expect(averageTime).toBeLessThan(1);
    });

    it('should check IP rate limits in <1ms on average', async () => {
      const { averageTime } = await measurePerformance(
        () => checkIpRateLimit(generateTestData.ip()),
        1000
      );

      expect(averageTime).toBeLessThan(1);
    });

    it('should handle 10,000 rate limit checks in <1 second', () => {
      const start = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        checkEmailRateLimit(`user${i}@test.com`);
      }
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent rate limit checks efficiently', async () => {
      const concurrency = 100;
      const emails = Array.from(
        { length: concurrency }, 
        () => generateTestData.email()
      );

      const start = performance.now();
      
      await Promise.all(
        emails.map(email => Promise.resolve(checkEmailRateLimit(email)))
      );
      
      const duration = performance.now() - start;
      
      // Should complete 100 concurrent checks in <50ms
      expect(duration).toBeLessThan(50);
    });

    it('should reset rate limits quickly', async () => {
      const email = generateTestData.email();
      checkEmailRateLimit(email);

      const { averageTime } = await measurePerformance(
        () => resetEmailRateLimit(email),
        100
      );

      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('API Response Performance', () => {
    it('should create success responses in <0.5ms', async () => {
      const data = { id: '123', name: 'Test User', items: [] };

      const { averageTime } = await measurePerformance(
        () => jsonSuccess(data),
        1000
      );

      expect(averageTime).toBeLessThan(0.5);
    });

    it('should create error responses in <0.5ms', async () => {
      const { averageTime } = await measurePerformance(
        () => jsonError('Test error'),
        1000
      );

      expect(averageTime).toBeLessThan(0.5);
    });

    it('should parse JSON from responses quickly', async () => {
      const data = { 
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@test.com`,
        }))
      };

      const response = jsonSuccess(data);

      const start = performance.now();
      await response.json();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should handle large error objects efficiently', async () => {
      const largeError = {
        message: 'Validation failed',
        details: Array.from({ length: 100 }, (_, i) => ({
          field: `field${i}`,
          error: `Error message ${i}`,
          code: `ERR_${i}`,
        })),
      };

      const { averageTime } = await measurePerformance(
        () => badRequest(largeError.message),
        100
      );

      expect(averageTime).toBeLessThan(1);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with many rate limit entries', () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const before = process.memoryUsage().heapUsed;

      // Create 10,000 rate limit entries
      for (let i = 0; i < 10000; i++) {
        checkEmailRateLimit(`user${i}@test.com`);
      }

      const after = process.memoryUsage().heapUsed;
      const increase = after - before;

      // Should use less than 50MB for 10k entries
      expect(increase).toBeLessThan(50 * 1024 * 1024);
    });

    it('should not accumulate memory with repeated operations', () => {
      if (global.gc) {
        global.gc();
      }

      const email = generateTestData.email();
      const before = process.memoryUsage().heapUsed;

      // Perform same operation 10,000 times
      for (let i = 0; i < 10000; i++) {
        checkEmailRateLimit(email);
        resetEmailRateLimit(email);
      }

      if (global.gc) {
        global.gc();
      }

      const after = process.memoryUsage().heapUsed;
      const increase = after - before;

      // Memory should not grow significantly with repeated ops
      expect(increase).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle response creation without memory leaks', async () => {
      if (global.gc) {
        global.gc();
      }

      const before = process.memoryUsage().heapUsed;

      // Create 10,000 responses
      for (let i = 0; i < 10000; i++) {
        const response = jsonSuccess({ count: i });
        await response.json(); // Parse to simulate real usage
      }

      if (global.gc) {
        global.gc();
      }

      const after = process.memoryUsage().heapUsed;
      const increase = after - before;

      // Should not accumulate memory
      expect(increase).toBeLessThan(30 * 1024 * 1024);
    });
  });

  describe('Scalability', () => {
    it('should scale linearly with number of rate limit checks', () => {
      const measurements = [100, 1000, 10000].map(count => {
        const start = performance.now();
        
        for (let i = 0; i < count; i++) {
          checkEmailRateLimit(`user${i}@test.com`);
        }
        
        return {
          count,
          duration: performance.now() - start,
          perOp: (performance.now() - start) / count,
        };
      });

      // Time per operation should be relatively consistent
      const perOpTimes = measurements.map(m => m.perOp);
      const avgPerOp = perOpTimes.reduce((a, b) => a + b) / perOpTimes.length;
      
      perOpTimes.forEach(time => {
        // Each operation should be within 50% of average
        expect(time).toBeGreaterThan(avgPerOp * 0.5);
        expect(time).toBeLessThan(avgPerOp * 1.5);
      });
    });

    it('should handle burst traffic efficiently', async () => {
      const burstSize = 1000;
      const bursts = 5;

      for (let burst = 0; burst < bursts; burst++) {
        const start = performance.now();
        
        await Promise.all(
          Array.from({ length: burstSize }, (_, i) => 
            Promise.resolve(checkEmailRateLimit(`burst${burst}_user${i}@test.com`))
          )
        );
        
        const duration = performance.now() - start;
        
        // Each burst should complete in <100ms
        expect(duration).toBeLessThan(100);
      }
    });
  });

  describe('Response Time Under Load', () => {
    it('should maintain response times under concurrent load', async () => {
      const concurrentRequests = 50;
      const iterations = 10;

      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        await Promise.all(
          Array.from({ length: concurrentRequests }, () =>
            Promise.resolve(jsonSuccess({ data: 'test' }))
          )
        );
        
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);

      // Average should be fast
      expect(avgTime).toBeLessThan(10);
      
      // Max shouldn't be more than 2x average (consistent performance)
      expect(maxTime).toBeLessThan(avgTime * 2);
    });
  });

  describe('Throughput', () => {
    it('should achieve high throughput for rate limit checks', () => {
      const duration = 1000; // 1 second
      const start = performance.now();
      let operations = 0;

      while (performance.now() - start < duration) {
        checkEmailRateLimit(`user${operations}@test.com`);
        operations++;
      }

      // Should handle at least 100,000 ops/second
      expect(operations).toBeGreaterThan(100000);
    });

    it('should achieve high throughput for response creation', () => {
      const duration = 1000; // 1 second
      const start = performance.now();
      let operations = 0;

      while (performance.now() - start < duration) {
        jsonSuccess({ count: operations });
        operations++;
      }

      // Should handle at least 50,000 response creations/second
      expect(operations).toBeGreaterThan(50000);
    });
  });

  describe('CPU Efficiency', () => {
    it('should not cause CPU spikes with many operations', () => {
      const start = process.cpuUsage();

      // Perform intensive operations
      for (let i = 0; i < 100000; i++) {
        checkEmailRateLimit(`user${i % 1000}@test.com`);
      }

      const usage = process.cpuUsage(start);
      const totalMicroseconds = usage.user + usage.system;
      const totalSeconds = totalMicroseconds / 1000000;

      // Should complete in reasonable CPU time (<5 seconds)
      expect(totalSeconds).toBeLessThan(5);
    });
  });

  describe('Garbage Collection Impact', () => {
    it('should minimize garbage collection pressure', () => {
      if (!global.gc) {
        console.warn('Run with --expose-gc flag for GC tests');
        return;
      }

      global.gc();
      const before = process.memoryUsage();

      // Create temporary objects
      for (let i = 0; i < 10000; i++) {
        const response = jsonSuccess({ temp: i });
        JSON.stringify(response);
      }

      global.gc();
      const after = process.memoryUsage();

      // Heap should not grow significantly after GC
      const heapGrowth = after.heapUsed - before.heapUsed;
      expect(heapGrowth).toBeLessThan(5 * 1024 * 1024); // <5MB
    });
  });

  describe('Cache Performance', () => {
    it('should benefit from repeated identical requests', () => {
      const email = generateTestData.email();

      // First check (cache miss)
      const start1 = performance.now();
      checkEmailRateLimit(email);
      const duration1 = performance.now() - start1;

      // Subsequent checks (cache hit)
      const start2 = performance.now();
      for (let i = 0; i < 100; i++) {
        checkEmailRateLimit(email);
      }
      const duration2 = performance.now() - start2;
      const avgCached = duration2 / 100;

      // Cached checks should be faster or similar
      expect(avgCached).toBeLessThanOrEqual(duration1 * 1.5);
    });
  });
});