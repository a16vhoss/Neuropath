/**
 * Push Notification Prompt
 * A compact card that prompts users to enable push notifications
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  isSubscribedToPush
} from '../services/webPushService';

const PushNotificationPrompt: React.FC = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user?.id) return;

      // Check if already dismissed
      const wasDismissed = localStorage.getItem(`push_prompt_dismissed_${user.id}`);
      if (wasDismissed) {
        setDismissed(true);
        return;
      }

      // Check if push is supported
      if (!isPushSupported()) return;

      // Check if permission is denied
      if (getNotificationPermission() === 'denied') return;

      // Check if already subscribed
      const subscribed = await isSubscribedToPush();
      if (subscribed) return;

      // Show the prompt
      setVisible(true);
    };

    checkStatus();
  }, [user?.id]);

  const handleEnable = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const subscription = await subscribeToPush(user.id);
      if (subscription) {
        setVisible(false);
      }
    } catch (error) {
      console.error('Error enabling push:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    if (user?.id) {
      localStorage.setItem(`push_prompt_dismissed_${user.id}`, 'true');
    }
    setDismissed(true);
    setVisible(false);
  };

  if (!visible || dismissed) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-4 -right-4 w-16 h-16 bg-indigo-100 rounded-full opacity-50" />

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>

      {/* Content */}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-indigo-500">notifications_active</span>
          <h4 className="font-bold text-slate-900 text-sm">Activa las notificaciones</h4>
        </div>

        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
          Recibe recordatorios de tu racha, tareas pendientes y tarjetas por repasar.
        </p>

        <button
          onClick={handleEnable}
          disabled={loading}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Activando...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">notifications</span>
              Activar
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PushNotificationPrompt;
