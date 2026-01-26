/**
 * Push Notification Settings Component
 * Allows users to enable/disable push notifications
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  initializePushNotifications
} from '../services/webPushService';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences
} from '../services/NotificationService';

const PushNotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      if (!user?.id) return;

      setLoading(true);
      try {
        // Check if push is supported
        const supported = isPushSupported();
        setPushSupported(supported);

        if (supported) {
          // Initialize service worker
          await initializePushNotifications();

          // Check permission
          setPermission(getNotificationPermission());

          // Check if subscribed
          const subscribed = await isSubscribedToPush();
          setPushEnabled(subscribed);
        }

        // Load preferences from database
        const prefs = await getNotificationPreferences(user.id);
        setPreferences(prefs);
      } catch (error) {
        console.error('Error loading push settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadState();
  }, [user?.id]);

  // Handle toggle push notifications
  const handleTogglePush = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      if (pushEnabled) {
        // Unsubscribe
        await unsubscribeFromPush(user.id);
        setPushEnabled(false);
      } else {
        // Subscribe
        const subscription = await subscribeToPush(user.id);
        if (subscription) {
          setPushEnabled(true);
          setPermission('granted');
        } else {
          // Permission was denied or error occurred
          setPermission(getNotificationPermission());
        }
      }
    } catch (error) {
      console.error('Error toggling push:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle toggle individual preference
  const handleTogglePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id || !preferences) return;

    setSaving(true);
    try {
      const updated = await updateNotificationPreferences(user.id, { [key]: value });
      if (updated) {
        setPreferences(updated);
      }
    } catch (error) {
      console.error('Error updating preference:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600">notifications_active</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Notificaciones Push</h3>
            <p className="text-sm text-slate-500">Recibe alertas incluso cuando no estes en la app</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Push Support Check */}
        {!pushSupported ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 mt-0.5">info</span>
            <div>
              <p className="font-medium text-amber-800">Navegador no compatible</p>
              <p className="text-sm text-amber-700 mt-1">
                Tu navegador no soporta notificaciones push. Prueba con Chrome, Firefox, Edge o Safari.
              </p>
            </div>
          </div>
        ) : permission === 'denied' ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
            <span className="material-symbols-outlined text-rose-500 mt-0.5">block</span>
            <div>
              <p className="font-medium text-rose-800">Permisos bloqueados</p>
              <p className="text-sm text-rose-700 mt-1">
                Has bloqueado las notificaciones. Para habilitarlas, ve a la configuracion de tu navegador.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Main Push Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-600">
                  {pushEnabled ? 'notifications_active' : 'notifications_off'}
                </span>
                <div>
                  <p className="font-medium text-slate-900">Notificaciones Push</p>
                  <p className="text-sm text-slate-500">
                    {pushEnabled ? 'Recibiras alertas en tu dispositivo' : 'Las notificaciones estan desactivadas'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTogglePush}
                disabled={saving}
                className={`relative w-14 h-8 rounded-full transition-colors ${
                  pushEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                } ${saving ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    pushEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Individual Preferences */}
            {pushEnabled && preferences && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Tipos de notificaciones:</p>

                {[
                  { key: 'streak_reminders', label: 'Recordatorios de racha', icon: 'local_fire_department', description: 'Cuando tu racha esta en riesgo' },
                  { key: 'assignment_reminders', label: 'Tareas pendientes', icon: 'assignment', description: 'Cuando tienes tareas por entregar' },
                  { key: 'flashcard_reminders', label: 'Tarjetas por repasar', icon: 'style', description: 'Cuando tienes tarjetas pendientes' },
                  { key: 'battle_invites', label: 'Invitaciones a batallas', icon: 'swords', description: 'Cuando alguien te reta' }
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-500">{item.icon}</span>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences[item.key as keyof NotificationPreferences] as boolean}
                      onChange={(e) => handleTogglePreference(item.key as keyof NotificationPreferences, e.target.checked)}
                      disabled={saving}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        )}

        {/* Test Notification Button */}
        {pushEnabled && (
          <button
            onClick={async () => {
              const { showLocalNotification } = await import('../services/webPushService');
              showLocalNotification('Prueba de Notificacion', {
                body: 'Las notificaciones push estan funcionando correctamente.',
                tag: 'test'
              });
            }}
            className="w-full py-3 px-4 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">send</span>
            Enviar notificacion de prueba
          </button>
        )}
      </div>
    </div>
  );
};

export default PushNotificationSettings;
