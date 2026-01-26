// app/dashboard/notifications/preferences/page.tsx
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import Link from "next/link";
import { ArrowLeft, Bell, Mail, MessageSquare } from "lucide-react";
import { PreferencesForm } from "./PreferencesForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOTIFICATION_TYPES = [
  {
    type: 'NEW_APPLICATION',
    label: 'Nuevas aplicaciones',
    description: 'Cuando un candidato aplica a tus vacantes',
  },
  {
    type: 'APPLICATION_STATUS_CHANGE',
    label: 'Cambios de estado',
    description: 'Cuando cambia el estado de tu aplicación',
  },
  {
    type: 'ASSESSMENT_INVITATION',
    label: 'Invitaciones a evaluaciones',
    description: 'Cuando te invitan a completar una evaluación',
  },
  {
    type: 'ASSESSMENT_COMPLETED',
    label: 'Evaluaciones completadas',
    description: 'Cuando un candidato completa una evaluación',
  },
] as const;

const CHANNELS = [
  { value: 'IN_APP', label: 'En la aplicación' },
  { value: 'EMAIL', label: 'Correo electrónico' },
] as const;

export default async function NotificationPreferencesPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/notifications/preferences');
  }

  const userId = session.user.id;

  // Fetch existing preferences
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId },
  });

  // Create a map for easy lookup
  // Schema has: type, inApp, email, webhook (not channel/enabled)
  const prefsMap = preferences.reduce((acc, pref) => {
    if (pref.inApp) acc[`${pref.type}_IN_APP`] = true;
    if (pref.email) acc[`${pref.type}_EMAIL`] = true;
    return acc;
  }, {} as Record<string, boolean>);

  // Build initial state with defaults
  const initialPreferences = NOTIFICATION_TYPES.flatMap((type) =>
    CHANNELS.map((channel) => {
      const key = `${type.type}_${channel.value}`;
      return {
        type: type.type,
        channel: channel.value,
        enabled: prefsMap[key] ?? true, // Default to enabled
      };
    })
  );

  return (
    <main className="max-w-none p-0">
      <div className="mx-auto max-w-[900px] px-6 lg:px-10 py-8 space-y-6">
        {/* Header */}
        <header>
          <Link
            href="/dashboard/notifications"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a notificaciones
          </Link>
          
          <h1 className="text-2xl font-bold leading-tight flex items-center gap-3">
            <Bell className="w-7 h-7 text-blue-600" />
            Preferencias de Notificaciones
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configura cómo y cuándo quieres recibir notificaciones
          </p>
        </header>

        {/* Preferences Form */}
        <div className="glass-card rounded-2xl border p-6 space-y-6">
          <PreferencesForm
            userId={userId}
            notificationTypes={NOTIFICATION_TYPES}
            channels={CHANNELS}
            initialPreferences={initialPreferences}
          />
        </div>

        {/* Info Card */}
        <div className="glass-card rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Sobre las notificaciones
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                • Las notificaciones en la aplicación se muestran en tiempo real<br />
                • Los correos electrónicos se envían de forma inmediata<br />
                • Puedes desactivar cualquier tipo de notificación en cualquier momento
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}