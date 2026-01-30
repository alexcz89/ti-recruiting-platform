// app/dashboard/notifications/preferences/PreferencesForm.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/lib/ui/toast";
import { Check, X } from "lucide-react";

interface Preference {
  type: string;
  channel: string;
  enabled: boolean;
}

interface PreferencesFormProps {
  userId: string;
  notificationTypes: readonly any[];
  channels: readonly any[];
  initialPreferences: Preference[];
}

export function PreferencesForm({
  userId,
  notificationTypes,
  channels,
  initialPreferences,
}: PreferencesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preferences, setPreferences] = useState<Preference[]>(initialPreferences);
  const [hasChanges, setHasChanges] = useState(false);

  const togglePreference = (type: string, channel: string) => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.type === type && pref.channel === channel
          ? { ...pref, enabled: !pref.enabled }
          : pref
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences }),
        });

        if (response.ok) {
          toastSuccess('Preferencias guardadas');
          setHasChanges(false);
          router.refresh();
        } else {
          toastError('Error al guardar preferencias');
        }
      } catch (error) {
        console.error('Error saving preferences:', error);
        toastError('Error al guardar preferencias');
      }
    });
  };

  const handleReset = () => {
    setPreferences(initialPreferences);
    setHasChanges(false);
    toastInfo('Cambios descartados');
  };

  const isEnabled = (type: string, channel: string) => {
    return preferences.find((p) => p.type === type && p.channel === channel)?.enabled ?? true;
  };

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                Tipo de notificación
              </th>
              {channels.map((channel) => (
                <th
                  key={channel.value}
                  className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300"
                >
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {notificationTypes.map((notifType) => (
              <tr
                key={notifType.type}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition"
              >
                <td className="py-4 px-4">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {notifType.label}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {notifType.description}
                    </p>
                  </div>
                </td>
                {channels.map((channel) => {
                  const enabled = isEnabled(notifType.type, channel.value);
                  return (
                    <td key={channel.value} className="py-4 px-4 text-center">
                      <button
                        onClick={() => togglePreference(notifType.type, channel.value)}
                        disabled={isPending}
                        className={`
                          inline-flex items-center justify-center w-10 h-10 rounded-lg transition
                          ${enabled
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-600 dark:hover:bg-gray-700'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={enabled ? 'Activado' : 'Desactivado'}
                      >
                        {enabled ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <X className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
          >
            Descartar cambios
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 font-medium"
          >
            {isPending ? 'Guardando...' : 'Guardar preferencias'}
          </button>
        </div>
      )}
    </div>
  );
}