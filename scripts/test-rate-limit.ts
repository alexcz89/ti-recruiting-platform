// scripts/test-rate-limit.ts
/**
 * Script para probar el sistema de rate limiting
 * 
 * NOTA: Este test copia la lógica de rate-limit.ts sin 'server-only'
 * para poder ejecutarse con tsx/node directamente.
 * 
 * Para testing real, usa los tests de Next.js o prueba en desarrollo.
 */

// ============================================
// Copia de la lógica de rate-limit.ts sin 'server-only'
// ============================================

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

const emailLimitStore: RateLimitStore = new Map();
const ipLimitStore: RateLimitStore = new Map();

const RATE_LIMITS = {
  PASSWORD_RESET_EMAIL: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
  },
  PASSWORD_RESET_IP: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  },
};

function checkRateLimit(
  store: RateLimitStore,
  key: string,
  maxAttempts: number,
  windowMs: number
) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt,
    };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}

function checkEmailRateLimit(email: string, config = RATE_LIMITS.PASSWORD_RESET_EMAIL) {
  const key = `email:${email.toLowerCase().trim()}`;
  return checkRateLimit(emailLimitStore, key, config.maxAttempts, config.windowMs);
}

function checkIpRateLimit(ip: string, config = RATE_LIMITS.PASSWORD_RESET_IP) {
  const key = `ip:${ip}`;
  return checkRateLimit(ipLimitStore, key, config.maxAttempts, config.windowMs);
}

function checkPasswordResetRateLimit(email: string, ip?: string) {
  const emailLimit = checkEmailRateLimit(email);

  if (!emailLimit.allowed) {
    return {
      allowed: false,
      reason: 'email' as const,
      retryAfter: emailLimit.retryAfter,
      remaining: 0,
    };
  }

  if (ip) {
    const ipLimit = checkIpRateLimit(ip);
    if (!ipLimit.allowed) {
      return {
        allowed: false,
        reason: 'ip' as const,
        retryAfter: ipLimit.retryAfter,
        remaining: 0,
      };
    }
    return {
      allowed: true,
      remaining: Math.min(emailLimit.remaining, ipLimit.remaining),
    };
  }

  return {
    allowed: true,
    remaining: emailLimit.remaining,
  };
}

function resetEmailRateLimit(email: string) {
  const key = `email:${email.toLowerCase().trim()}`;
  emailLimitStore.delete(key);
}

function getRateLimitStats() {
  return {
    emailLimits: emailLimitStore.size,
    ipLimits: ipLimitStore.size,
  };
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}

// ============================================
// Tests
// ============================================

console.log('🧪 Iniciando tests de Rate Limiting...\n');

// Test 1: Email rate limit (3 intentos / 15 min)
console.log('📧 Test 1: Rate limit por email');
const testEmail = 'test@example.com';

for (let i = 1; i <= 5; i++) {
  const result = checkEmailRateLimit(testEmail);
  console.log(
    `  Intento ${i}: ${result.allowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'} - Restantes: ${result.remaining}${
      result.retryAfter ? ` - Reintentar en: ${formatRetryAfter(result.retryAfter)}` : ''
    }`
  );
}

console.log('\n🔄 Reseteando email rate limit...');
resetEmailRateLimit(testEmail);
console.log('✅ Reset completado\n');

// Test 2: IP rate limit (10 intentos / hora)
console.log('🌐 Test 2: Rate limit por IP');
const testIp = '192.168.1.100';

for (let i = 1; i <= 12; i++) {
  const result = checkIpRateLimit(testIp);
  const status = result.allowed ? '✅' : '❌';
  
  if (i <= 3 || i >= 10) {
    console.log(
      `  Intento ${i}: ${status} ${result.allowed ? 'PERMITIDO' : 'BLOQUEADO'} - Restantes: ${result.remaining}`
    );
  } else if (i === 4) {
    console.log('  ...');
  }
}

console.log('\n🔐 Test 3: Rate limit combinado (email + IP)');
const email2 = 'user@test.com';
const ip2 = '10.0.0.50';

for (let i = 1; i <= 4; i++) {
  const result = checkPasswordResetRateLimit(email2, ip2);
  console.log(
    `  Intento ${i}: ${result.allowed ? '✅ PERMITIDO' : '❌ BLOQUEADO'} - Remaining: ${result.remaining}${
      result.reason ? ` - Bloqueado por: ${result.reason}` : ''
    }`
  );
}

console.log('\n📊 Estadísticas finales:');
const stats = getRateLimitStats();
console.log(`  Emails tracked: ${stats.emailLimits}`);
console.log(`  IPs tracked: ${stats.ipLimits}`);

console.log('\n✅ Tests completados\n');
console.log('💡 Notas:');
console.log('  - Email limit: 3 intentos / 15 minutos');
console.log('  - IP limit: 10 intentos / hora');
console.log('  - Los límites se resetean automáticamente después del tiempo de espera');
console.log('  - Las entradas expiradas se limpian automáticamente cada 5 minutos');
console.log('\n🚀 Para probar en desarrollo:');
console.log('  1. npm run dev');
console.log('  2. Ve a /auth/signin');
console.log('  3. Click en "¿Olvidaste tu contraseña?"');
console.log('  4. Intenta solicitar reset 4 veces con el mismo email\n');