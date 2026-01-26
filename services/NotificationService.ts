/**
 * Notification Service
 * Handles in-app notifications and push notification preferences
 */

import { supabase, supabaseUrl } from './supabaseClient';

// Types
export type NotificationType =
  | 'streak_reminder'
  | 'assignment_due'
  | 'flashcards_due'
  | 'battle_invite'
  | 'achievement'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  streak_reminders: boolean;
  assignment_reminders: boolean;
  flashcard_reminders: boolean;
  battle_invites: boolean;
  push_enabled: boolean;
  push_subscription: PushSubscriptionJSON | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationParams {
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}

// Notification icon mapping
export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  streak_reminder: 'local_fire_department',
  assignment_due: 'assignment',
  flashcards_due: 'style',
  battle_invite: 'swords',
  achievement: 'emoji_events',
  system: 'info'
};

// Notification color mapping
export const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  streak_reminder: 'text-orange-500 bg-orange-50',
  assignment_due: 'text-blue-500 bg-blue-50',
  flashcards_due: 'text-violet-500 bg-violet-50',
  battle_invite: 'text-red-500 bg-red-50',
  achievement: 'text-amber-500 bg-amber-50',
  system: 'text-slate-500 bg-slate-50'
};

/**
 * Get notifications for a user
 */
export const getNotifications = async (
  userId: string,
  limit: number = 20,
  offset: number = 0
): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
  }
};

/**
 * Create a new notification
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<Notification | null> => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.user_id,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return null;
  }

  return data;
};

/**
 * Create multiple notifications (batch)
 */
export const createNotificationsBatch = async (
  notifications: CreateNotificationParams[]
): Promise<number> => {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notifications.map(n => ({
      user_id: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data || {}
    })));

  if (error) {
    console.error('Error creating notifications batch:', error);
    return 0;
  }

  return notifications.length;
};

/**
 * Get notification preferences for a user
 */
export const getNotificationPreferences = async (
  userId: string
): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching notification preferences:', error);
    return null;
  }

  // If no preferences exist, create default ones
  if (!data) {
    return createDefaultPreferences(userId);
  }

  return data;
};

/**
 * Create default notification preferences for a new user
 */
const createDefaultPreferences = async (
  userId: string
): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabase
    .from('notification_preferences')
    .insert({
      user_id: userId,
      streak_reminders: true,
      assignment_reminders: true,
      flashcard_reminders: true,
      battle_invites: true,
      push_enabled: false,
      push_subscription: null
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating default preferences:', error);
    return null;
  }

  return data;
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (
  userId: string,
  preferences: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreferences | null> => {
  const { data, error } = await supabase
    .from('notification_preferences')
    .update(preferences)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating notification preferences:', error);
    return null;
  }

  return data;
};

/**
 * Save push subscription for a user
 */
export const savePushSubscription = async (
  userId: string,
  subscription: PushSubscriptionJSON
): Promise<void> => {
  const { error } = await supabase
    .from('notification_preferences')
    .update({
      push_enabled: true,
      push_subscription: subscription
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error saving push subscription:', error);
  }
};

/**
 * Remove push subscription for a user
 */
export const removePushSubscription = async (userId: string): Promise<void> => {
  const { error } = await supabase
    .from('notification_preferences')
    .update({
      push_enabled: false,
      push_subscription: null
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error removing push subscription:', error);
  }
};

/**
 * Helper to format relative time
 */
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

/**
 * Send a push notification via Supabase Edge Function
 */
export interface SendPushParams {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export const sendPushNotification = async (params: SendPushParams): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: params
    });

    if (error) {
      console.error('Error sending push notification:', error);
      return false;
    }

    console.log('Push notification result:', data);
    return data?.success || false;
  } catch (error) {
    console.error('Error calling push function:', error);
    return false;
  }
};

/**
 * Create notification AND send push (convenience function)
 */
export const notifyUser = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
  sendPush: boolean = true
): Promise<Notification | null> => {
  // Create in-app notification
  const notification = await createNotification({
    user_id: userId,
    type,
    title,
    message,
    data
  });

  // Send push notification if enabled
  if (sendPush) {
    await sendPushNotification({
      user_id: userId,
      title,
      body: message,
      tag: type,
      data: { url: data?.url, type, ...data }
    });
  }

  return notification;
};
