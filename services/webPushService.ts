/**
 * Web Push Service
 * Handles service worker registration and push notification subscriptions
 */

import { savePushSubscription, removePushSubscription } from './NotificationService';

// VAPID public key - in production, this should come from environment variables
// This is a placeholder - you'll need to generate your own keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Check if push notifications are supported
 */
export const isPushSupported = (): boolean => {
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Check if notifications are permitted
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
};

/**
 * Register the service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[WebPush] Service worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[WebPush] Service worker registration failed:', error);
    return null;
  }
};

/**
 * Get existing service worker registration
 */
export const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[WebPush] Error getting service worker:', error);
    return null;
  }
};

/**
 * Convert VAPID key to Uint8Array for subscription
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPush = async (userId: string): Promise<PushSubscription | null> => {
  try {
    // Request permission first
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') {
      console.log('[WebPush] Permission not granted');
      return null;
    }

    // Get service worker registration
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      console.error('[WebPush] No service worker registration');
      return null;
    }

    // Check if already subscribed
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('[WebPush] Already subscribed');
      // Save to database in case it's not there
      await savePushSubscription(userId, existingSubscription.toJSON());
      return existingSubscription;
    }

    // Check if VAPID key is configured
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[WebPush] VAPID public key not configured');
      return null;
    }

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('[WebPush] Subscribed:', subscription.endpoint);

    // Save subscription to database
    await savePushSubscription(userId, subscription.toJSON());

    return subscription;
  } catch (error) {
    console.error('[WebPush] Subscription error:', error);
    return null;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async (userId: string): Promise<boolean> => {
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[WebPush] Unsubscribed');
    }

    // Remove from database
    await removePushSubscription(userId);

    return true;
  } catch (error) {
    console.error('[WebPush] Unsubscribe error:', error);
    return false;
  }
};

/**
 * Check if user is subscribed to push
 */
export const isSubscribedToPush = async (): Promise<boolean> => {
  try {
    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('[WebPush] Error checking subscription:', error);
    return false;
  }
};

/**
 * Show a local notification (for testing or immediate feedback)
 */
export const showLocalNotification = async (
  title: string,
  options?: NotificationOptions
): Promise<void> => {
  if (Notification.permission !== 'granted') {
    console.warn('[WebPush] Notification permission not granted');
    return;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    // Fallback to basic notification
    new Notification(title, options);
    return;
  }

  await registration.showNotification(title, {
    icon: '/logo192.png',
    badge: '/logo192.png',
    ...options
  } as NotificationOptions);
};

/**
 * Initialize push notifications on app load
 */
export const initializePushNotifications = async (): Promise<void> => {
  if (!isPushSupported()) {
    console.log('[WebPush] Push notifications not supported');
    return;
  }

  // Register service worker
  await registerServiceWorker();
};
