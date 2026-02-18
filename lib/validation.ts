// lib/validation.ts
import { z } from "zod";

// ================================
// Helpers
// ================================
export * from "@/lib/shared/schemas/profile";

export const EmailSchema = z.string().email("Email inválido");

export const PhoneMxSchema = z
  .string()
  .min(10, "Teléfono muy corto")
  .regex(/^\+?(\d[\s-]?){10,15}$/, "Teléfono inválido");

// ================================
// 1) Schema usado actualmente por signup de Candidato
// ✅ MANTENER (usado por CV Builder)
// ================================
export const CandidateSignupSchema = z.object({
  name: z.string().min(1, "Nombre es obligatorio"),
  email: EmailSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
export type CandidateSignupInput = z.infer<typeof CandidateSignupSchema>;

// ================================
// 2) Versión extendida (Registro completo de candidato)
// ✅ MANTENER
// ================================
export const CandidateRegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(120),
  email: EmailSchema.max(190),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),

  lastName: z.string().min(2, "Apellido muy corto").max(120).optional(),
  location: z.string().min(2, "Ubicación requerida").optional(),
  birthdate: z.string().optional(),

  linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
  github: z.string().url("URL inválida").optional().or(z.literal("")),
  phone: PhoneMxSchema.optional().or(z.literal("")),

  skills: z.array(z.string()).optional().default([]),
  cvUrl: z.string().url("URL inválida").optional(),
});
export type CandidateRegisterInput = z.infer<typeof CandidateRegisterSchema>;

// ================================
// 3) Registro de Reclutador / Empresa
// ✅ MANTENER
// ================================
export const RecruiterRegisterSchema = z.object({
  companyName: z.string().min(2, "Nombre de empresa requerido"),
  name: z.string().min(2, "Nombre requerido"),
  email: EmailSchema,
  password: z.string().min(6, "Mínimo 6 caracteres"),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  country: z.string().min(2, "País requerido"),
  city: z.string().min(2, "Ciudad requerida"),
});

// ================================
// 4) Validación de Vacante
// ✅ MANTENER
// ================================
export const JobSchema = z.object({
  title: z.string().min(3, "Título muy corto"),
  description: z.string().min(10, "Descripción muy corta"),
  location: z.string().min(2, "Ubicación requerida"),
  skills: z.array(z.string()).min(1, "Agrega al menos una skill"),
  grossSalary: z.coerce.number().nonnegative().optional(),
  benefitsLaw: z.boolean().default(true),
});

// ================================
// 5) Actualización de Perfil (candidato)
// ✅ MANTENER
// ================================
export const ProfileUpdateSchema = z.object({
  location: z.string().min(2, "Ubicación requerida"),
  phone: PhoneMxSchema.optional().or(z.literal("")),
  linkedin: z.string().url("URL inválida").optional().or(z.literal("")),
  github: z.string().url("URL inválida").optional().or(z.literal("")),
  skills: z.array(z.string()).min(1, "Agrega al menos una skill"),
});

// ================================
// 6) Login
// ✅ MANTENER
// ================================
export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(3, "Contraseña muy corta"),
});
export type SignInInput = z.infer<typeof SignInSchema>;

// ================================
// ✨ NUEVO: SIGNUP MULTI-STEP
// ================================

/**
 * Helpers para validación de contraseña
 */
export function calculatePasswordStrength(password: string): number {
  let strength = 0;
  
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;
  
  return Math.min(strength, 4);
}

export function getPasswordRequirements(password: string) {
  return [
    {
      label: 'Mínimo 8 caracteres',
      met: password.length >= 8,
    },
    {
      label: 'Una letra mayúscula',
      met: /[A-Z]/.test(password),
    },
    {
      label: 'Una letra minúscula',
      met: /[a-z]/.test(password),
    },
    {
      label: 'Un número',
      met: /[0-9]/.test(password),
    },
    {
      label: 'Un símbolo (!@#$%^&*)',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

/**
 * Paso 1: Datos básicos
 */
export const SignupStep1Schema = z.object({
  firstName: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede exceder 50 caracteres')
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      'El nombre solo puede contener letras, espacios, guiones y apóstrofes'
    )
    .transform(str => str.trim()),

  lastName: z.string()
    .min(2, 'El apellido debe tener al menos 2 caracteres')
    .max(50, 'El apellido no puede exceder 50 caracteres')
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/,
      'El apellido solo puede contener letras'
    )
    .transform(str => str.trim()),

  maternalSurname: z.string()
    .max(50, 'El apellido materno no puede exceder 50 caracteres')
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]*$/,
      'Solo puede contener letras'
    )
    .transform(str => str.trim())
    .optional()
    .or(z.literal('')),

  email: z.string()
    .min(1, 'El email es requerido')
    .email('Formato de email inválido')
    .toLowerCase()
    .transform(str => str.trim())
    .refine(
      (email) => {
        const domain = email.split('@')[1];
        const blockedDomains = ['tempmail.com', 'guerrillamail.com', '10minutemail.com'];
        return !blockedDomains.includes(domain);
      },
      'Por favor usa un email válido y permanente'
    ),
});

export type SignupStep1Data = z.infer<typeof SignupStep1Schema>;

/**
 * Paso 2: Contraseña (CON confirmPassword para el frontend)
 */
export const SignupStep2Schema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres')
    .refine(
      (password) => /[A-Z]/.test(password),
      'Debe contener al menos una letra mayúscula'
    )
    .refine(
      (password) => /[a-z]/.test(password),
      'Debe contener al menos una letra minúscula'
    )
    .refine(
      (password) => /[0-9]/.test(password),
      'Debe contener al menos un número'
    )
    .refine(
      (password) => /[^A-Za-z0-9]/.test(password),
      'Debe contener al menos un carácter especial (!@#$%^&*)'
    )
    .refine(
      (password) => {
        const commonPasswords = [
          'password', 'password123', '12345678', 'qwerty', 
          'abc123', 'password1', '123456789', 'welcome'
        ];
        return !commonPasswords.includes(password.toLowerCase());
      },
      'Esta contraseña es demasiado común'
    ),

  confirmPassword: z.string()
    .min(1, 'Por favor confirma tu contraseña'),
})
.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  }
);

export type SignupStep2Data = z.infer<typeof SignupStep2Schema>;

/**
 * Paso 3: Perfil profesional
 */
export const SignupStep3Schema = z.object({
  phone: z.string()
    .regex(
      /^\+?[1-9]\d{1,14}$/,
      'Formato de teléfono inválido'
    )
    .optional()
    .or(z.literal('')),

  location: z.string()
    .min(3, 'La ubicación debe tener al menos 3 caracteres')
    .max(200)
    .optional()
    .or(z.literal('')),
    
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  placeId: z.string().optional(),

  linkedin: z.string()
    .url('URL inválida')
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname.includes('linkedin.com');
        } catch {
          return false;
        }
      },
      'Debe ser una URL válida de LinkedIn'
    )
    .optional()
    .or(z.literal('')),

  github: z.string()
    .url('URL inválida')
    .refine(
      (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.hostname === 'github.com';
        } catch {
          return false;
        }
      },
      'Debe ser una URL válida de GitHub'
    )
    .optional()
    .or(z.literal('')),
});

export type SignupStep3Data = z.infer<typeof SignupStep3Schema>;

/**
 * Schema completo del signup multi-step (incluye confirmPassword)
 * Nota: No se puede usar .merge() con SignupStep2Schema porque tiene .refine()
 */
export const CompleteSignupSchema = SignupStep1Schema
  .merge(z.object({
    password: z.string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(100, 'La contraseña no puede exceder 100 caracteres')
      .refine(
        (password) => /[A-Z]/.test(password),
        'Debe contener al menos una letra mayúscula'
      )
      .refine(
        (password) => /[a-z]/.test(password),
        'Debe contener al menos una letra minúscula'
      )
      .refine(
        (password) => /[0-9]/.test(password),
        'Debe contener al menos un número'
      )
      .refine(
        (password) => /[^A-Za-z0-9]/.test(password),
        'Debe contener al menos un carácter especial (!@#$%^&*)'
      )
      .refine(
        (password) => {
          const commonPasswords = [
            'password', 'password123', '12345678', 'qwerty', 
            'abc123', 'password1', '123456789', 'welcome'
          ];
          return !commonPasswords.includes(password.toLowerCase());
        },
        'Esta contraseña es demasiado común'
      ),
    confirmPassword: z.string().min(1, 'Por favor confirma tu contraseña'),
  }))
  .merge(SignupStep3Schema)
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Las contraseñas no coinciden',
      path: ['confirmPassword'],
    }
  );

export type CompleteSignupData = z.infer<typeof CompleteSignupSchema>;

/**
 * ✅ CORRECCIÓN: Schema para el backend (SIN confirmPassword)
 * Creamos un schema de password separado sin el campo confirmPassword
 */
const PasswordOnlySchema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña no puede exceder 100 caracteres')
    .refine(
      (password) => /[A-Z]/.test(password),
      'Debe contener al menos una letra mayúscula'
    )
    .refine(
      (password) => /[a-z]/.test(password),
      'Debe contener al menos una letra minúscula'
    )
    .refine(
      (password) => /[0-9]/.test(password),
      'Debe contener al menos un número'
    )
    .refine(
      (password) => /[^A-Za-z0-9]/.test(password),
      'Debe contener al menos un carácter especial (!@#$%^&*)'
    )
    .refine(
      (password) => {
        const commonPasswords = [
          'password', 'password123', '12345678', 'qwerty', 
          'abc123', 'password1', '123456789', 'welcome'
        ];
        return !commonPasswords.includes(password.toLowerCase());
      },
      'Esta contraseña es demasiado común'
    ),
});

export const BackendSignupSchema = SignupStep1Schema
  .merge(PasswordOnlySchema)
  .merge(SignupStep3Schema)
  .extend({
    role: z.enum(['CANDIDATE', 'RECRUITER']).default('CANDIDATE'),
  });

export type BackendSignupData = z.infer<typeof BackendSignupSchema>;