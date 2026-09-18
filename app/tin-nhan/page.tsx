"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "../../components/Header";
import AuthGuard from "../../components/AuthGuard";
import { MessageCircle, Send } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase-browser";

type Message = {
  id: string;
  listing_id?: string | null;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

function getQuery(name: string) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function MessagesPage() {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [error, setError] = useState("");

  const getListingId = () => getQuery("listing");
  const getPartnerId = () => getQuery("with");

  async function loadInbox(u: any) {
    setError("");

    const { data: rows, error: messageError } = await supabaseBrowser
      .from("messages")
      .select("id,listing_id,sender_id,receiver_id,body,created_at,read_at")
      .or("sender_id.eq." + u.id + ",receiver_id.eq." + u.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (messageError) {
      setError(messageError.message);
      setInbox([]);
      return;
    }

    const allMessages = rows || [];
    const listingIds = [
      ...new Set(allMessages.map((x: any) => x.listing_id).filter(Boolean)),
    ];
    const partnerIds = [
      ...new Set(
        allMessages
          .map((x: any) =>
            x.sender_id === u.id ? x.receiver_id : x.sender_id
          )
          .filter(Boolean)
      ),
    ];

    if (!listingIds.length) {
      setInbox([]);
      return;
    }

    const [profileResult, listingResult] = await Promise.all([
      partnerIds.length
        ? supabaseBrowser
            .from("profiles")
            .select("id,full_name,avatar_url")
            .in("id", partnerIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseBrowser
        .from("listings")
        .select("id,title,price,images,seller_id,status")
        .in("id", listingIds),
    ]);

    if (profileResult.error || listingResult.error) {
      setError(
        profileResult.error?.message ||
          listingResult.error?.message ||
          "Không tải được dữ liệu cuộc trò chuyện."
      );
      setInbox([]);
      return;
    }

    const profileMap = new Map(
      (profileResult.data || []).map((x: any) => [x.id, x])
    );
    const listingMap = new Map(
      (listingResult.data || []).map((x: any) => [x.id, x])
    );
    const seen = new Set<string>();
    const conversations: any[] = [];

    for (const row of allMessages) {
      if (!row.listing_id) continue;

      const partnerId =
        row.sender_id === u.id ? row.receiver_id : row.sender_id;
      const key = row.listing_id + ":" + partnerId;

      if (seen.has(key)) continue;
      seen.add(key);

      const item = listingMap.get(row.listing_id);
      if (!item) continue;

      const unread = allMessages.filter(
        (m: any) =>
          m.listing_id === row.listing_id &&
          m.sender_id === partnerId &&
          m.receiver_id === u.id &&
          !m.read_at
      ).length;

      conversations.push({
        ...row,
        listing: item,
        partner_id: partnerId,
        partner: profileMap.get(partnerId),
        unread,
      });
    }

    setInbox(conversations);
  }

  async function loadConversation(
    u: any,
    listingId: string,
    partnerId?: string | null
  ) {
    setError("");

    const [listingResult, messageResult] = await Promise.all([
      supabaseBrowser
        .from("listings")
        .select("id,title,price,images,seller_id,status")
        .eq("id", listingId)
        .maybeSingle(),
      supabaseBrowser
        .from("messages")
        .select(
          "id,listing_id,sender_id,receiver_id,body,created_at,read_at"
        )
        .eq("listing_id", listingId)
        .or("sender_id.eq." + u.id + ",receiver_id.eq." + u.id)
        .order("created_at", { ascending: true }),
    ]);

    if (listingResult.error || messageResult.error) {
      setError(
        listingResult.error?.message ||
          messageResult.error?.message ||
          "Không tải được cuộc trò chuyện."
      );
      setListing(null);
      setMessages([]);
      return;
    }

    const currentListing = listingResult.data;
    const allMessages = messageResult.data || [];

    setListing(currentListing);

    if (!currentListing) {
      setMessages([]);
      return;
    }

    const conversation = allMessages.filter(
      (m: any) =>
        !partnerId ||
        (m.sender_id === u.id && m.receiver_id === partnerId) ||
        (m.sender_id === partnerId && m.receiver_id === u.id)
    );

    setMessages(conversation);

    const partnerIds = [
      ...new Set(
        conversation
          .map((m: any) =>
            m.sender_id === u.id ? m.receiver_id : m.sender_id
          )
          .filter((id: string) => id && id !== u.id)
      ),
    ];

    if (partnerIds.length) {
      await supabaseBrowser
        .from("profiles")
        .select("id,full_name,avatar_url")
        .in("id", partnerIds);
    }

    await supabaseBrowser
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("listing_id", listingId)
      .eq("receiver_id", u.id)
      .is("read_at", null);
  }

  async function load() {
    setLoading(true);
    setError("");

    const {
      data: { user: currentUser },
    } = await supabaseBrowser.auth.getUser();

    setUser(currentUser);

    if (!currentUser) {
      setLoading(false);
      return;
    }

    const listingId = getListingId();
    const partnerId = getPartnerId();

    if (listingId) {
      await loadConversation(currentUser, listingId, partnerId);
    } else {
      setListing(null);
      setMessages([]);
      await loadInbox(currentUser);
    }

    setLoading(false);
  }

  useEffect(() => {
    let channel: any;

    (async () => {
      await load();

      const {
        data: { user: currentUser },
      } = await supabaseBrowser.auth.getUser();

      if (!currentUser) return;

      const listingId = getListingId();

      channel = supabaseBrowser
        .channel(
          listingId
            ? "messages-listing-" + listingId
            : "messages-inbox-" + currentUser.id
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: listingId
              ? "listing_id=eq." + listingId
              : "receiver_id=eq." + currentUser.id,
          },
          async () => {
            await load();
          }
        )
        .subscribe((status) => {
          setRealtime(status === "SUBSCRIBED");
        });
    })();

    return () => {
      if (channel) supabaseBrowser.removeChannel(channel);
    };
  }, [pathname]);

  async function send() {
    const body = text.trim();
    if (!body || !user || !listing || sending) return;

    const partnerId = getPartnerId();
    const receiverId =
      partnerId ||
      (user.id === listing.seller_id
        ? messages.find((m) => m.sender_id !== user.id)?.sender_id
        : listing.seller_id);

    if (!receiverId || receiverId === user.id) {
      window.alert("Chưa xác định được người nhận tin nhắn.");
      return;
    }

    setSending(true);

    const { error: insertError } = await supabaseBrowser
      .from("messages")
      .insert({
        listing_id: listing.id,
        sender_id: user.id,
        receiver_id: receiverId,
        body,
      });

    if (insertError) {
      window.alert(insertError.message);
    } else {
      setText("");
      await loadConversation(user, listing.id, receiverId);
    }

    setSending(false);
  }

  return (
    <AuthGuard>
      <Header />
      <section className="container-page py-8">
        {!getListingId() ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
                  Trao đổi
                </p>
                <h1 className="mt-1 text-3xl font-black">Tin nhắn</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {realtime ? "Đang kết nối realtime" : "Đang kết nối..."}
                </p>
              </div>
              <MessageCircle className="text-brand-600" />
            </div>

            {error && (
              <div className="card mt-5 border-red-200 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-10 text-center text-slate-500">
                Đang tải...
              </div>
            ) : !inbox.length ? (
              <div className="card mt-6 p-10 text-center text-slate-500">
                Bạn chưa có cuộc trò chuyện nào.
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {inbox.map((item) => (
                  <Link
                    key={item.id}
                    href={
                      "/tin-nhan?listing=" +
                      encodeURIComponent(item.listing_id) +
                      "&with=" +
                      encodeURIComponent(item.partner_id)
                    }
                    className="card flex gap-4 p-4 hover:shadow-soft"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {item.listing.images?.[0] && (
                        <img
                          src={item.listing.images[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="truncate font-black">
                          {item.listing.title}
                        </h2>
                        {item.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-brand-600 px-2 py-1 text-[10px] font-black text-white">
                            {item.unread}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-2 truncate text-xs font-bold text-brand-700">
                        {item.partner?.avatar_url && (
                          <img
                            src={item.partner.avatar_url}
                            alt=""
                            className="h-5 w-5 shrink-0 rounded-full object-cover"
                          />
                        )}
                        {item.partner?.full_name || "Người dùng"}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.body}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Link
              href="/tin-nhan"
              className="text-sm font-bold text-brand-700"
            >
              ← Tất cả tin nhắn
            </Link>

            {error && (
              <div className="card mt-5 border-red-200 p-4 text-sm text-red-600">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-10 text-center text-slate-500">
                Đang tải...
              </div>
            ) : !listing ? (
              <div className="card mt-5 p-10 text-center">
                Không tìm thấy tin.
              </div>
            ) : (
              <div className="mx-auto mt-5 max-w-2xl card overflow-hidden">
                <div className="border-b p-5">
                  <p className="text-xs font-bold text-brand-600">
                    TRAO ĐỔI VỀ TIN
                  </p>
                  <h1 className="mt-1 font-black">{listing.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Người bán: {listing.seller_id === user?.id
                      ? "Bạn"
                      : "Người bán"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {realtime
                      ? "● Realtime đang hoạt động"
                      : "○ Đang kết nối realtime"}
                  </p>
                </div>

                <div className="min-h-[360px] space-y-3 bg-slate-50 p-5">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={
                        "flex " +
                        (message.sender_id === user?.id
                          ? "justify-end"
                          : "justify-start")
                      }
                    >
                      <div
                        className={
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm " +
                          (message.sender_id === user?.id
                            ? "bg-brand-600 text-white"
                            : "border bg-white")
                        }
                      >
                        {message.body}
                        <div className="mt-1 text-[10px] opacity-60">
                          {new Date(message.created_at).toLocaleString("vi-VN")}
                        </div>
                      </div>
                    </div>
                  ))}

                  {!messages.length && (
                    <div className="pt-24 text-center text-slate-400">
                      Chưa có tin nhắn. Hãy hỏi người bán về sản phẩm.
                    </div>
                  )}
                </div>

                <div className="flex gap-2 border-t p-4">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={
                      user?.id === listing.seller_id
                        ? "Trả lời người mua..."
                        : "Nhập tin nhắn..."
                    }
                    maxLength={2000}
                    className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-brand-400"
                  />
                  <button
                    type="button"
                    disabled={sending || !text.trim()}
                    onClick={send}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-5 font-extrabold text-white disabled:opacity-50"
                  >
                    <Send size={16} />
                    Gửi
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </AuthGuard>
  );
}
