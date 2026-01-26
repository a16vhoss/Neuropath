/**
 * Supabase Edge Function: Send Push Notification
 *
 * This function sends Web Push notifications to subscribed users.
 *
 * Deploy: supabase functions deploy send-push-notification
 *
 * Environment variables needed in Supabase Dashboard:
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (e.g., "mailto:admin@yourapp.com")
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push library for Deno
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@neuropath.app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase credentials not configured");
    }

    // Configure web-push
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const payload: PushPayload = await req.json();

    if (!payload.title || !payload.body) {
      throw new Error("title and body are required");
    }

    // Get target user IDs
    const targetUserIds: string[] = [];
    if (payload.user_id) {
      targetUserIds.push(payload.user_id);
    } else if (payload.user_ids && payload.user_ids.length > 0) {
      targetUserIds.push(...payload.user_ids);
    } else {
      throw new Error("user_id or user_ids is required");
    }

    // Get push subscriptions for target users
    const { data: preferences, error: prefError } = await supabase
      .from("notification_preferences")
      .select("user_id, push_subscription")
      .in("user_id", targetUserIds)
      .eq("push_enabled", true)
      .not("push_subscription", "is", null);

    if (prefError) {
      throw prefError;
    }

    if (!preferences || preferences.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscribed users found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/logo192.png",
      badge: payload.badge || "/logo192.png",
      tag: payload.tag || "default",
      data: payload.data || {},
      actions: payload.actions || [],
    });

    // Send push to each subscription
    const results = await Promise.allSettled(
      preferences.map(async (pref) => {
        try {
          const subscription = pref.push_subscription;
          await webpush.sendNotification(subscription, notificationPayload);
          return { user_id: pref.user_id, success: true };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          console.error(`Failed to send to user ${pref.user_id}:`, errorMessage);

          // If subscription is invalid, remove it
          if (errorMessage.includes("410") || errorMessage.includes("404")) {
            await supabase
              .from("notification_preferences")
              .update({ push_enabled: false, push_subscription: null })
              .eq("user_id", pref.user_id);
          }

          return { user_id: pref.user_id, success: false, error: errorMessage };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        total: preferences.length,
        results: results.map((r) =>
          r.status === "fulfilled" ? r.value : { success: false, error: "Promise rejected" }
        ),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
