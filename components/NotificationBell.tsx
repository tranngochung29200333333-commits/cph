"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../lib/supabase-browser";

const VAPID_PUBLIC_KEY = "BIdZDwpb6eA08fM0N3A_EAGoIYVLCMo1URG_ca-hEjFWXlcVAID4UcTlzJWXf2LLSxxTCOGCG4hlG0vTGCtLwRs";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load(userIdOverride?: string) {
    const id = userIdOverride || userId;
    if (!id) return;
    const { count } = await supabaseBrowser
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .is("read_at", null);
    setUnread(count || 0);
  }

  async function enablePush(id: string) {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    setBusy(true);
    try {
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") return false;

      const swPath = window.location.hostname.endsWith("github.io") ? "/cph/sw.js" : "/sw.js";
      const registration = await navigator.serviceWorker.register(swPath, { scope: swPath.replace(/sw\.js$/, "") });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

      const { error } = await supabaseBrowser.from("push_subscriptions").upsert({
        user_id: id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,endpoint" });
      if (error) throw error;
      setEnabled(true);
      return true;
    } catch (error) {
      console.error("Push notification setup failed:", error);
      return false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    let channel: any;

    (async () => {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);

      const canPush = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      setSupported(canPush);

      if (canPush) {
        const swPath = window.location.hostname.endsWith("github.io") ? "/cph/sw.js" : "/sw.js";
        const registration = await navigator.serviceWorker.register(swPath, { scope: swPath.replace(/sw\.js$/, "") });
        const subscription = await registration.pushManager.getSubscription();
        setEnabled(!!subscription);
      }

      await load(user.id);

      channel = supabaseBrowser
        .channel("notifications-" + user.id)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + user.id,
        }, async () => {
          await load(user.id);
        })
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabaseBrowser.removeChannel(channel);
    };
  }, []);

  async function openNotifications() {
    if (!userId) return;
    await supabaseBrowser
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setUnread(0);
  }

  if (!userId) return null;

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={openNotifications}
        className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-50"
        title={supported && !enabled ? "Bật thông báo trên máy" : "Thông báo"}
        aria-label="Thông báo"
      >
        {enabled ? <BellRing size={18} /> : <Bell size={18} />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {supported && !enabled && (
        <button
          type="button"
          disabled={busy}
          onClick={() => enablePush(userId)}
          className="hidden rounded-xl bg-brand-50 px-2.5 py-2 text-[11px] font-extrabold text-brand-700 xl:inline-flex"
        >
          {busy ? "Đang bật..." : "Bật thông báo"}
        </button>
      )}
    </div>
  );
}
