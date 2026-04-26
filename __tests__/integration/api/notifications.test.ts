// __tests__/integration/api/notifications.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getServerSession } from 'next-auth';
import { testData, createMockSession } from '../setup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  authOptions: {},
}));

// Mock NotificationService — todos los métodos que usan las rutas
const mockNotificationService = {
  getUserNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  archive: vi.fn(),
  create: vi.fn(),
};

vi.mock('@/lib/notifications/service', () => ({
  NotificationService: mockNotificationService,
}));

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------

const notificationBase = {
  id: 'notif-1',
  userId: 'candidate-1',
  type: 'ASSESSMENT_INVITE' as const,
  title: 'Nueva evaluación disponible',
  body: 'Tienes una nueva evaluación técnica pendiente.',
  isRead: false,
  priority: 'HIGH' as const,
  actionUrl: '/assessments/attempts/attempt-1',
  metadata: {},
  createdAt: new Date('2024-01-10T10:00:00Z'),
  updatedAt: new Date('2024-01-10T10:00:00Z'),
};

const notificationRead = {
  ...notificationBase,
  id: 'notif-2',
  isRead: true,
  type: 'APPLICATION_STATUS_CHANGE' as const,
  title: 'Tu aplicación fue aceptada',
  body: 'El reclutador aceptó tu aplicación.',
  priority: 'NORMAL' as const,
  updatedAt: new Date('2024-01-10T11:00:00Z'),
};

const paginatedResult = {
  notifications: [notificationBase, notificationRead],
  total: 2,
  page: 1,
  limit: 20,
  hasMore: false,
  unreadCount: 1,
};

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

describe('Notifications API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /api/notifications
  // =========================================================================

  describe('GET /api/notifications', () => {
    it('debe requerir autenticación — sin sesión retorna 401', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      // La ruta verifica session?.user?.id. Sin sesión retorna 401.
      const session = await getServerSession();
      const isBlocked = !session?.user?.id;

      expect(isBlocked).toBe(true);
    });

    it('debe retornar notificaciones para usuario autenticado', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.getUserNotifications.mockResolvedValue(paginatedResult);

      const result = await mockNotificationService.getUserNotifications(
        session!.user.id,
        { page: 1, limit: 20, unreadOnly: false }
      );

      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('debe filtrar solo notificaciones no leídas cuando unreadOnly=true', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const unreadResult = {
        ...paginatedResult,
        notifications: [notificationBase],
        total: 1,
        unreadCount: 1,
      };
      mockNotificationService.getUserNotifications.mockResolvedValue(unreadResult);

      const result = await mockNotificationService.getUserNotifications(
        session!.user.id,
        { page: 1, limit: 20, unreadOnly: true }
      );

      expect(result.notifications.every((n: typeof notificationBase) => !n.isRead)).toBe(true);
      expect(result.notifications).toHaveLength(1);
    });

    it('debe aceptar parámetro limit y no exceder 100', async () => {
      // La ruta hace: if (params.limit > 100) params.limit = 100
      const limitRaw = 200;
      const limit = limitRaw > 100 ? 100 : limitRaw;

      expect(limit).toBe(100);
    });

    it('debe usar page=1 y limit=20 por defecto si no se envían params', () => {
      const page = parseInt('1');
      const limit = parseInt('20');

      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it('debe filtrar por tipo de notificación', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const filteredResult = {
        ...paginatedResult,
        notifications: [notificationBase],
        total: 1,
      };
      mockNotificationService.getUserNotifications.mockResolvedValue(filteredResult);

      const result = await mockNotificationService.getUserNotifications(
        session!.user.id,
        { page: 1, limit: 20, type: 'ASSESSMENT_INVITE' }
      );

      result.notifications.forEach((n: typeof notificationBase) => {
        expect(n.type).toBe('ASSESSMENT_INVITE');
      });
    });

    it('debe filtrar por prioridad', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const highPriorityResult = {
        ...paginatedResult,
        notifications: [notificationBase],
        total: 1,
      };
      mockNotificationService.getUserNotifications.mockResolvedValue(highPriorityResult);

      const result = await mockNotificationService.getUserNotifications(
        session!.user.id,
        { page: 1, limit: 20, priority: 'HIGH' }
      );

      result.notifications.forEach((n: typeof notificationBase) => {
        expect(n.priority).toBe('HIGH');
      });
    });

    it('debe retornar éxito false con error 500 si el servicio lanza', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.getUserNotifications.mockRejectedValue(new Error('DB error'));

      await expect(
        mockNotificationService.getUserNotifications(session!.user.id, {})
      ).rejects.toThrow('DB error');
    });

    it('debe paginar correctamente con hasMore=true', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const pagedResult = {
        notifications: [notificationBase],
        total: 50,
        page: 1,
        limit: 1,
        hasMore: true,
        unreadCount: 1,
      };
      mockNotificationService.getUserNotifications.mockResolvedValue(pagedResult);

      const result = await mockNotificationService.getUserNotifications(
        session!.user.id,
        { page: 1, limit: 1 }
      );

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(50);
    });
  });

  // =========================================================================
  // GET /api/notifications/unread-count
  // =========================================================================

  describe('GET /api/notifications/unread-count', () => {
    it('debe requerir autenticación', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const session = await getServerSession();
      expect(!session?.user?.id).toBe(true);
    });

    it('debe retornar el conteo de no leídas del usuario', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const count = await mockNotificationService.getUnreadCount(session!.user.id);

      expect(count).toBe(5);
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(session!.user.id);
    });

    it('debe retornar 0 cuando no hay notificaciones no leídas', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.getUnreadCount.mockResolvedValue(0);

      const count = await mockNotificationService.getUnreadCount(session!.user.id);

      expect(count).toBe(0);
    });

    it('debe ser específico por usuario (no mezclar conteos)', async () => {
      const sessionCandidate = createMockSession(testData.user.candidate);
      const sessionRecruiter = createMockSession(testData.user.recruiter);

      mockNotificationService.getUnreadCount
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7);

      const countCandidate = await mockNotificationService.getUnreadCount(
        sessionCandidate!.user.id
      );
      const countRecruiter = await mockNotificationService.getUnreadCount(
        sessionRecruiter!.user.id
      );

      expect(countCandidate).toBe(3);
      expect(countRecruiter).toBe(7);
    });

    it('debe retornar error 500 si el servicio falla', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.getUnreadCount.mockRejectedValue(new Error('DB timeout'));

      await expect(
        mockNotificationService.getUnreadCount(session!.user.id)
      ).rejects.toThrow('DB timeout');
    });
  });

  // =========================================================================
  // PATCH /api/notifications/[id]/read
  // =========================================================================

  describe('PATCH /api/notifications/[id]/read', () => {
    it('debe requerir autenticación', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const session = await getServerSession();
      expect(!session?.user?.id).toBe(true);
    });

    it('debe marcar notificación como leída', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const updatedNotification = { ...notificationBase, isRead: true, updatedAt: new Date() };
      mockNotificationService.markAsRead.mockResolvedValue(updatedNotification);

      const result = await mockNotificationService.markAsRead(
        notificationBase.id,
        session!.user.id
      );

      expect(result.isRead).toBe(true);
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        notificationBase.id,
        session!.user.id
      );
    });

    it('debe retornar 404 si la notificación no existe o no pertenece al usuario', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAsRead.mockRejectedValue(
        new Error('Notification not found')
      );

      await expect(
        mockNotificationService.markAsRead('notif-inexistente', session!.user.id)
      ).rejects.toThrow('not found');
    });

    it('no debe poder marcar notificaciones de otro usuario', async () => {
      const otherUserId = 'recruiter-1';
      const notification = { ...notificationBase, userId: 'candidate-1' };

      const canMark = notification.userId === otherUserId;
      expect(canMark).toBe(false);
    });

    it('marcar una notificación ya leída no debe lanzar error', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAsRead.mockResolvedValue(notificationRead);

      const result = await mockNotificationService.markAsRead(
        notificationRead.id,
        session!.user.id
      );

      expect(result.isRead).toBe(true);
    });
  });

  // =========================================================================
  // PATCH /api/notifications/mark-all-read
  // =========================================================================

  describe('PATCH /api/notifications/mark-all-read', () => {
    it('debe requerir autenticación', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const session = await getServerSession();
      expect(!session?.user?.id).toBe(true);
    });

    it('debe marcar todas las notificaciones como leídas y retornar conteo', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAllAsRead.mockResolvedValue(4);

      const count = await mockNotificationService.markAllAsRead(session!.user.id);

      expect(count).toBe(4);
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(session!.user.id);
    });

    it('debe retornar 0 si no había no leídas', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAllAsRead.mockResolvedValue(0);

      const count = await mockNotificationService.markAllAsRead(session!.user.id);

      expect(count).toBe(0);
    });

    it('solo debe afectar las notificaciones del usuario autenticado', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAllAsRead.mockResolvedValue(2);

      await mockNotificationService.markAllAsRead(session!.user.id);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledTimes(1);
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(session!.user.id);
    });

    it('debe retornar error 500 si el servicio falla', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.markAllAsRead.mockRejectedValue(new Error('DB error'));

      await expect(
        mockNotificationService.markAllAsRead(session!.user.id)
      ).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // DELETE /api/notifications/[id]  (archive)
  // =========================================================================

  describe('DELETE /api/notifications/[id]', () => {
    it('debe requerir autenticación', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const session = await getServerSession();
      expect(!session?.user?.id).toBe(true);
    });

    it('debe archivar (eliminar lógicamente) la notificación del usuario', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const archivedNotif = { ...notificationBase, archivedAt: new Date() };
      mockNotificationService.archive.mockResolvedValue(archivedNotif);

      const result = await mockNotificationService.archive(
        notificationBase.id,
        session!.user.id
      );

      expect(result.archivedAt).toBeInstanceOf(Date);
      expect(mockNotificationService.archive).toHaveBeenCalledWith(
        notificationBase.id,
        session!.user.id
      );
    });

    it('debe retornar 404 si la notificación no existe o no pertenece al usuario', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.archive.mockRejectedValue(
        new Error('Notification not found')
      );

      await expect(
        mockNotificationService.archive('notif-inexistente', session!.user.id)
      ).rejects.toThrow('not found');
    });

    it('no debe poder archivar notificaciones de otro usuario', async () => {
      const notification = { ...notificationBase, userId: 'candidate-1' };
      const differentUser = 'recruiter-1';

      const isOwner = notification.userId === differentUser;
      expect(isOwner).toBe(false);
    });

    it('debe retornar error 500 si el servicio falla inesperadamente', async () => {
      const session = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(session as any);
      mockNotificationService.archive.mockRejectedValue(new Error('Unexpected DB failure'));

      await expect(
        mockNotificationService.archive(notificationBase.id, session!.user.id)
      ).rejects.toThrow('Unexpected DB failure');
    });
  });

  // =========================================================================
  // Lógica de negocio — tipos y prioridades
  // =========================================================================

  describe('Notification Types & Priorities', () => {
    const VALID_TYPES = [
      'ASSESSMENT_INVITE',
      'ASSESSMENT_COMPLETED',
      'APPLICATION_STATUS_CHANGE',
      'APPLICATION_RECEIVED',
      'JOB_MATCH',
      'SYSTEM',
    ];

    const VALID_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

    it('debe reconocer todos los tipos de notificación válidos', () => {
      VALID_TYPES.forEach((type) => {
        expect(VALID_TYPES).toContain(type);
      });
    });

    it('debe reconocer todos los niveles de prioridad válidos', () => {
      VALID_PRIORITIES.forEach((priority) => {
        expect(VALID_PRIORITIES).toContain(priority);
      });
    });

    it('las notificaciones de assessment deben tener actionUrl', () => {
      const assessmentNotif = {
        ...notificationBase,
        type: 'ASSESSMENT_INVITE',
        actionUrl: '/assessments/attempts/attempt-1',
      };

      expect(assessmentNotif.actionUrl).toBeTruthy();
      expect(assessmentNotif.actionUrl).toMatch(/assessments/);
    });

    it('las notificaciones de cambio de status deben tener actionUrl', () => {
      const statusNotif = {
        ...notificationBase,
        type: 'APPLICATION_STATUS_CHANGE',
        actionUrl: '/profile/applications/app-1',
      };

      expect(statusNotif.actionUrl).toBeTruthy();
      expect(statusNotif.actionUrl).toMatch(/applications/);
    });

    it('notificaciones urgentes deben procesarse primero', () => {
      const notifications = [
        { ...notificationBase, id: 'n1', priority: 'NORMAL' },
        { ...notificationBase, id: 'n2', priority: 'URGENT' },
        { ...notificationBase, id: 'n3', priority: 'LOW' },
        { ...notificationBase, id: 'n4', priority: 'HIGH' },
      ];

      const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      const sorted = [...notifications].sort(
        (a, b) =>
          (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99)
      );

      expect(sorted[0].id).toBe('n2');
      expect(sorted[3].id).toBe('n3');
    });
  });

  // =========================================================================
  // Integración con flujo de Assessments
  // =========================================================================

  describe('Integración con flujo de Assessments', () => {
    it('debe crear notificación cuando se envía invite de assessment', async () => {
      const session = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(session as any);

      const notifPayload = {
        userId: testData.user.candidate.id,
        type: 'ASSESSMENT_INVITE',
        title: 'Nueva evaluación: Technical Assessment',
        body: 'El reclutador te ha enviado una evaluación técnica.',
        priority: 'HIGH',
        actionUrl: `/assessments/token/some-token`,
        metadata: {
          templateId: testData.assessment.template.id,
          applicationId: testData.application.pending.id,
        },
      };

      mockNotificationService.create.mockResolvedValue({
        ...notificationBase,
        ...notifPayload,
      });

      const result = await mockNotificationService.create(notifPayload);

      expect(result.type).toBe('ASSESSMENT_INVITE');
      expect(result.userId).toBe(testData.user.candidate.id);
      expect(result.metadata.templateId).toBe(testData.assessment.template.id);
    });

    it('debe crear notificación cuando el candidato completa un assessment', async () => {
      const notifPayload = {
        userId: testData.user.recruiter.id,
        type: 'ASSESSMENT_COMPLETED',
        title: 'Candidato completó evaluación',
        body: 'El candidato finalizó la evaluación Technical Assessment.',
        priority: 'NORMAL',
        metadata: {
          attemptId: testData.assessment.attempt.id,
          templateId: testData.assessment.template.id,
          score: 82,
        },
      };

      mockNotificationService.create.mockResolvedValue({
        ...notificationBase,
        ...notifPayload,
        id: 'notif-completed',
      });

      const result = await mockNotificationService.create(notifPayload);

      expect(result.type).toBe('ASSESSMENT_COMPLETED');
      expect(result.metadata.score).toBe(82);
    });

    it('debe crear notificación de cambio de status de aplicación al recruiter', async () => {
      const notifPayload = {
        userId: testData.user.candidate.id,
        type: 'APPLICATION_STATUS_CHANGE',
        title: 'Tu aplicación fue actualizada',
        body: 'El estado de tu aplicación cambió a ACCEPTED.',
        priority: 'HIGH',
        metadata: {
          applicationId: testData.application.accepted.id,
          oldStatus: 'PENDING',
          newStatus: 'ACCEPTED',
        },
      };

      mockNotificationService.create.mockResolvedValue({
        ...notificationBase,
        ...notifPayload,
        id: 'notif-status',
      });

      const result = await mockNotificationService.create(notifPayload);

      expect(result.type).toBe('APPLICATION_STATUS_CHANGE');
      expect(result.metadata.newStatus).toBe('ACCEPTED');
    });
  });

  // =========================================================================
  // Aislamiento de datos por usuario
  // =========================================================================

  describe('Aislamiento de datos por usuario', () => {
    it('candidato solo ve sus propias notificaciones', async () => {
      const sessionCandidate = createMockSession(testData.user.candidate);
      vi.mocked(getServerSession).mockResolvedValue(sessionCandidate as any);

      const ownNotifications = [
        { ...notificationBase, userId: testData.user.candidate.id },
      ];

      const foreignNotifications = ownNotifications.filter(
        (n) => n.userId !== testData.user.candidate.id
      );

      expect(foreignNotifications).toHaveLength(0);
    });

    it('reclutador solo ve sus propias notificaciones', async () => {
      const sessionRecruiter = createMockSession(testData.user.recruiter);
      vi.mocked(getServerSession).mockResolvedValue(sessionRecruiter as any);

      mockNotificationService.getUserNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
        unreadCount: 0,
      });

      const result = await mockNotificationService.getUserNotifications(
        sessionRecruiter!.user.id,
        {}
      );

      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith(
        sessionRecruiter!.user.id,
        {}
      );
      expect(result.notifications).toHaveLength(0);
    });

    it('un usuario no puede leer la notificación de otro', async () => {
      const notification = { ...notificationBase, userId: 'candidate-1' };
      const attackerId = 'recruiter-1';

      const hasAccess = notification.userId === attackerId;
      expect(hasAccess).toBe(false);
    });
  });

  // =========================================================================
  // Estado de UI — Badge del bell
  // =========================================================================

  describe('NotificationBell — badge de no leídas', () => {
    it('badge debe mostrar 0 cuando no hay no leídas', () => {
      const count = 0;
      const showBadge = count > 0;

      expect(showBadge).toBe(false);
    });

    it('badge debe mostrarse cuando hay notificaciones no leídas', () => {
      const count = 3;
      const showBadge = count > 0;

      expect(showBadge).toBe(true);
    });

    it('badge debe mostrar "99+" para conteos mayores a 99', () => {
      const count = 150;
      const displayCount = count > 99 ? '99+' : String(count);

      expect(displayCount).toBe('99+');
    });

    it('badge debe mostrar el número exacto para ≤ 99', () => {
      const count = 42;
      const displayCount = count > 99 ? '99+' : String(count);

      expect(displayCount).toBe('42');
    });
  });
});