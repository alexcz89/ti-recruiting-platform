// app/auth/signin/password-reset-actions.ts
"use server";

import { prisma } from '@/lib/server/prisma';
import bcrypt from "bcryptjs";
import { createPasswordResetToken, verifyPasswordResetToken } from '@/lib/server/tokens';
import { sendPasswordResetEmail } from '@/lib/server/mailer';
import { checkPasswordResetRateLimit, formatRetryAfter, getClientIp } from '@/lib/server/rate-limit';
import { headers } from 'next/headers';

/**
 * Solicita un restablecimiento de contraseña
 * Envía un correo con un enlace JWT firmado
 * 
 * ✅ PROTECCIONES:
 * - Rate limiting por email (3 intentos / 15 min)
 * - Rate limiting por IP (10 intentos / hora)
 * - Respuesta genérica (no revela si el email existe)
 */
export async function requestPasswordReset(email: string) {
  try {
    // 🛡️ RATE LIMITING: Verificar antes de hacer queries a la BD
    const headersList = headers();
    const clientIp = getClientIp(headersList);
    
    const rateLimit = checkPasswordResetRateLimit(email, clientIp);
    
    if (!rateLimit.allowed) {
      const retryMessage = rateLimit.retryAfter 
        ? `Demasiados intentos. Intenta nuevamente en ${formatRetryAfter(rateLimit.retryAfter)}.`
        : 'Demasiados intentos. Intenta nuevamente más tarde.';
      
      return {
        success: false,
        message: retryMessage,
      };
    }

    // Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Por seguridad, siempre retornamos success aunque el usuario no exista
    // Esto previene que atacantes descubran qué emails están registrados
    if (!user) {
      return {
        success: true,
        message: "Si el correo existe, recibirás un enlace de recuperación.",
      };
    }

    // Generar token JWT firmado (válido por 1 hora)
    const resetToken = await createPasswordResetToken(
      {
        email: user.email,
        userId: user.id,
      },
      60 // 60 minutos
    );

    // Construir el enlace de restablecimiento
    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}`;

    // Enviar el correo
    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name || "Usuario",
        resetUrl,
      });
    } catch (emailError) {
      console.error("Error al enviar email:", emailError);
      return {
        success: false,
        message: "No se pudo enviar el correo. Intenta nuevamente más tarde.",
      };
    }

    return {
      success: true,
      message: "Si el correo existe, recibirás un enlace de recuperación.",
    };
  } catch (error) {
    console.error("Error en requestPasswordReset:", error);
    return {
      success: false,
      message: "Ocurrió un error. Intenta nuevamente.",
    };
  }
}

/**
 * Verifica si un token JWT de restablecimiento es válido
 */
export async function verifyResetToken(token: string) {
  try {
    // Verificar y decodificar el token JWT
    const decoded = await verifyPasswordResetToken(token);

    // Verificar que el usuario todavía existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return {
        valid: false,
        message: "El usuario ya no existe.",
      };
    }

    // Verificar que el email del token coincida con el usuario
    if (user.email.toLowerCase() !== decoded.email.toLowerCase()) {
      return {
        valid: false,
        message: "El token no corresponde a este usuario.",
      };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error("Error en verifyResetToken:", error);
    
    // Mensajes específicos según el error
    if (error instanceof Error) {
      if (error.message.includes("expirado")) {
        return {
          valid: false,
          message: "El enlace ha expirado. Solicita uno nuevo.",
        };
      }
      if (error.message.includes("inválido")) {
        return {
          valid: false,
          message: "El enlace es inválido.",
        };
      }
    }
    
    return {
      valid: false,
      message: "El enlace es inválido o ha expirado.",
    };
  }
}

/**
 * Restablece la contraseña del usuario usando un token JWT válido
 */
export async function resetPassword(token: string, newPassword: string) {
  try {
    // Verificar el token JWT
    const decoded = await verifyPasswordResetToken(token);

    // Verificar que el usuario existe
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: "Usuario no encontrado.",
      };
    }

    // Verificar que el email coincida
    if (user.email.toLowerCase() !== decoded.email.toLowerCase()) {
      return {
        success: false,
        message: "Token inválido.",
      };
    }

    // Hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
      },
    });

    return {
      success: true,
      message: "Contraseña restablecida exitosamente.",
    };
  } catch (error) {
    console.error("Error en resetPassword:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("expirado")) {
        return {
          success: false,
          message: "El enlace ha expirado. Solicita uno nuevo.",
        };
      }
    }
    
    return {
      success: false,
      message: "No se pudo restablecer la contraseña. Intenta nuevamente.",
    };
  }
}