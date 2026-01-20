// lib/server/rate-limit.ts
import 'server-only';

/**
 * Sistema de Rate Limiting en memoria
 * 
 * IMPORTANTE: Esto usa memoria del proceso. Si tienes múltiples instancias
 * (load balancer, serverless con múltiples workers), considera usar:
 * - Redis (Upstash, Vercel KV)
 * - PostgreSQL con tabla de rate_limits
 * - Vercel Edge Config
 * 
 * Para un solo servidor o serverless con baja concurrencia, esto funciona bien.
 */

type RateLimitEntry = {
  count: number;
  resetAt: number; // timestamp
};

type RateLimitStore = Map<string, RateLimitEntry>;

// Stores separados por tipo de límite
const emailLimitStore: RateLimitStore = new Map();
const ipLimitStore: RateLimitStore = new Map();

/**
 * Limpia entradas expiradas cada 5 minutos
 */
function setupCleanup(store: RateLimitStore) {
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    }, 5 * 60 * 1000); // 5 minutos
  }
}

// Inicializar cleanup
setupCleanup(emailLimitStore);
setupCleanup(ipLimitStore);

/**
 * Configuración de rate limits
 */
export const RATE_LIMITS = {
  PASSWORD_RESET_EMAIL: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000, // 15 minutos
  },
  PASSWORD_RESET_IP: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hora
  },
  // Puedes agregar más límites aquí para otros endpoints
  GENERAL_EMAIL: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutos
  },
} as const;

/**
 * Verifica y actualiza el rate limit
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
function checkRateLimit(
  store: RateLimitStore,
  key: string,
  maxAttempts: number,
  windowMs: number
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // segundos
} {
  const now = Date.now();
  const entry = store.get(key);

  // Si no existe o ya expiró, crear nueva entrada
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt,
    };
  }

  // Si ya alcanzó el límite
  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }

  // Incrementar contador
  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit por email (para password reset, verificación, etc.)
 */
export function checkEmailRateLimit(
  email: string,
  config = RATE_LIMITS.PASSWORD_RESET_EMAIL
) {
  const key = `email:${email.toLowerCase().trim()}`;
  return checkRateLimit(
    emailLimitStore,
    key,
    config.maxAttempts,
    config.windowMs
  );
}

/**
 * Rate limit por IP
 */
export function checkIpRateLimit(
  ip: string,
  config = RATE_LIMITS.PASSWORD_RESET_IP
) {
  const key = `ip:${ip}`;
  return checkRateLimit(ipLimitStore, key, config.maxAttempts, config.windowMs);
}

/**
 * Rate limit combinado: verifica tanto email como IP
 * Retorna el primer límite que falle
 */
export function checkPasswordResetRateLimit(email: string, ip?: string): {
  allowed: boolean;
  reason?: 'email' | 'ip';
  retryAfter?: number;
  remaining: number;
} {
  // 1. Verificar límite por email (3 intentos / 15 min)
  const emailLimit = checkEmailRateLimit(email);

  if (!emailLimit.allowed) {
    return {
      allowed: false,
      reason: 'email',
      retryAfter: emailLimit.retryAfter,
      remaining: 0,
    };
  }

  // 2. Verificar límite por IP si está disponible (10 intentos / hora)
  if (ip) {
    const ipLimit = checkIpRateLimit(ip);

    if (!ipLimit.allowed) {
      return {
        allowed: false,
        reason: 'ip',
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

/**
 * Resetea el rate limit de un email (útil para testing o admin)
 * ⚠️ Usar con precaución
 */
export function resetEmailRateLimit(email: string) {
  const key = `email:${email.toLowerCase().trim()}`;
  emailLimitStore.delete(key);
}

/**
 * Obtiene estadísticas del rate limit (para debugging)
 */
export function getRateLimitStats() {
  return {
    emailLimits: emailLimitStore.size,
    ipLimits: ipLimitStore.size,
  };
}

/**
 * Helper para obtener IP del request en Next.js
 * Considera proxies (Vercel, Cloudflare, etc.)
 */
export function getClientIp(headers: Headers): string | undefined {
  // Orden de prioridad para obtener la IP real
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for puede ser "client, proxy1, proxy2"
    // Tomamos la primera IP (cliente)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Vercel específico
  const vercelIp = headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp;
  }

  // Cloudflare
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  return undefined;
}

/**
 * Formatea el tiempo de retry en mensaje legible
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
}