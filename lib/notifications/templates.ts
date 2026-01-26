// lib/notifications/templates.ts
// Notification templates - defines how each type is formatted

import type { NotificationType } from '@prisma/client';

interface NotificationTemplate {
  title: (data: any) => string;
  message: (data: any) => string;
  actionText?: (data: any) => string;
  actionUrl: (data: any) => string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  defaultChannels: ('IN_APP' | 'EMAIL' | 'WEBHOOK')[];
  emailSubject: (data: any) => string;
  emailTemplate: string;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // ============================================
  // APPLICATION EVENTS
  // ============================================

  NEW_APPLICATION: {
    title: (data) => 'Nueva aplicación recibida',
    message: (data) => `${data.candidateName} aplicó a ${data.jobTitle}`,
    actionText: () => 'Ver aplicación',
    actionUrl: (data) => `/dashboard/jobs/${data.jobId}/applications`,
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `Nueva aplicación de ${data.candidateName}`,
    emailTemplate: 'new-application',
  },

  APPLICATION_STATUS_CHANGE: {
    title: (data) => 'Actualización en tu aplicación',
    message: (data) =>
      `Tu aplicación a ${data.jobTitle} cambió a: ${data.newStatus}`,
    actionText: () => 'Ver detalles',
    actionUrl: (data) => `/profile/applications`,
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `Actualización: ${data.jobTitle}`,
    emailTemplate: 'application-status-change',
  },

  APPLICATION_COMMENT: {
    title: (data) => 'Nuevo comentario',
    message: (data) =>
      `${data.authorName} comentó en tu aplicación`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/dashboard/jobs/${data.jobId}/applications`,
    priority: 'LOW',
    defaultChannels: ['IN_APP'],
    emailSubject: (data) => `Nuevo comentario`,
    emailTemplate: 'application-comment',
  },

  // ============================================
  // ASSESSMENT EVENTS
  // ============================================

  ASSESSMENT_INVITATION: {
    title: (data) => 'Invitación a evaluación',
    message: (data) =>
      `Has sido invitado a completar una evaluación para ${data.jobTitle}`,
    actionText: () => 'Iniciar',
    actionUrl: (data) => `/assessments/${data.templateId}`,
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: () => 'Invitación a evaluación técnica',
    emailTemplate: 'assessment-invitation',
  },

  ASSESSMENT_REMINDER: {
    title: (data) => 'Recordatorio: Evaluación pendiente',
    message: (data) =>
      `Tu evaluación para ${data.jobTitle} vence en ${data.hoursLeft} horas`,
    actionText: () => 'Completar',
    actionUrl: (data) => `/assessments/${data.templateId}`,
    priority: 'URGENT',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: () => 'Tu evaluación vence pronto',
    emailTemplate: 'assessment-reminder',
  },

  ASSESSMENT_COMPLETED: {
    title: (data) => 'Evaluación completada',
    message: (data) =>
      `${data.candidateName} completó la evaluación para ${data.jobTitle}`,
    actionText: () => 'Ver resultados',
    actionUrl: (data) => `/dashboard/assessments/attempts/${data.attemptId}/results`,
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `${data.candidateName} completó su evaluación`,
    emailTemplate: 'assessment-completed',
  },

  ASSESSMENT_RESULTS: {
    title: (data) => 'Resultados disponibles',
    message: (data) =>
      data.passed
        ? `¡Aprobaste la evaluación! (${data.score}%)`
        : `Completaste la evaluación (${data.score}%)`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/assessments/attempts/${data.attemptId}/results`,
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => data.passed ? '¡Aprobaste!' : 'Resultados listos',
    emailTemplate: 'assessment-results',
  },

  // ============================================
  // JOB EVENTS
  // ============================================

  JOB_POSTED: {
    title: (data) => 'Nuevo trabajo',
    message: (data) => `${data.companyName}: ${data.jobTitle}`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/jobs/${data.jobId}`,
    priority: 'LOW',
    defaultChannels: ['IN_APP'],
    emailSubject: () => 'Nuevas oportunidades',
    emailTemplate: 'job-posted',
  },

  JOB_CLOSING_SOON: {
    title: (data) => 'Vacante cierra pronto',
    message: (data) => `${data.jobTitle} cierra en ${data.daysLeft} días`,
    actionText: () => 'Aplicar',
    actionUrl: (data) => `/jobs/${data.jobId}`,
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP'],
    emailSubject: (data) => `${data.jobTitle} cierra pronto`,
    emailTemplate: 'job-closing-soon',
  },

  JOB_EXPIRED: {
    title: (data) => 'Vacante expirada',
    message: (data) =>
      `${data.jobTitle} expiró con ${data.applicationsCount} aplicaciones`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/dashboard/jobs/${data.jobId}`,
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `Vacante expirada: ${data.jobTitle}`,
    emailTemplate: 'job-expired',
  },

  // ============================================
  // TEAM EVENTS
  // ============================================

  TEAM_MENTION: {
    title: (data) => 'Te mencionaron',
    message: (data) => `${data.mentionedByName} te mencionó`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/dashboard`,
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `${data.mentionedByName} te mencionó`,
    emailTemplate: 'team-mention',
  },

  TEAM_ASSIGNED: {
    title: (data) => 'Nueva asignación',
    message: (data) =>
      `${data.assignedByName} te asignó revisar a ${data.candidateName}`,
    actionText: () => 'Ver',
    actionUrl: (data) => `/dashboard/jobs/${data.jobId}/applications`,
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `Nueva asignación: ${data.candidateName}`,
    emailTemplate: 'team-assigned',
  },

  // ============================================
  // SYSTEM EVENTS
  // ============================================

  ACCOUNT_VERIFIED: {
    title: () => '¡Cuenta verificada!',
    message: () => 'Tu cuenta ha sido verificada exitosamente',
    actionText: () => 'Ir al dashboard',
    actionUrl: () => '/dashboard',
    priority: 'MEDIUM',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: () => 'Cuenta verificada',
    emailTemplate: 'account-verified',
  },

  PASSWORD_RESET: {
    title: () => 'Restablecimiento de contraseña',
    message: () => 'Solicitud de restablecimiento recibida',
    actionText: () => 'Restablecer',
    actionUrl: () => '/auth/reset-password',
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: () => 'Restablecer contraseña',
    emailTemplate: 'password-reset',
  },

  SUBSCRIPTION_EXPIRING: {
    title: (data) => 'Suscripción vence pronto',
    message: (data) =>
      `Tu plan ${data.planName} vence en ${data.daysLeft} días`,
    actionText: () => 'Renovar',
    actionUrl: () => '/dashboard/billing',
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    emailSubject: (data) => `Tu suscripción vence en ${data.daysLeft} días`,
    emailTemplate: 'subscription-expiring',
  },
};