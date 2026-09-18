"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import Header from "../../components/Header";
import AuthGuard from "../../components/AuthGuard";
import {MessageCircle, Send} from "lucide-react";
import {supabaseBrowser} from "../../lib/supabase-browser";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
};

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [inbox, setInbox] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtime, setRealtime] = useState(false);
  const [error, setError] = useState("");

  const getListingId = () =>
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("listing");

  const getPartnerId = () =>
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("with");

  async function loadInbox(u: any) {
    const {data: rows} = await supabaseBrowser
      .from("messages")
      .select("id,listing_id,sender_id,receiver_id,body,created_at,read_at")
      .or("sender_id.eq." + u.id + ",receiver_id.eq." + u.id)
      .order("created_at", {ascending: false})
      .limit(200);

    const ids = [...new Set((rows || []).map((x: any) => x.listing_id).filter(Boolean))];
    const partners = [...new Set((rows || []).map((x: any) => x.sender_id === u.id ? x.receiver_id : x.sender_id).filter(Boolean))];

    if (!ids.length) {
      setInbox([]);
      return;
    }

    const {data: ps} = partners.length ? await supabaseBrowser.from("profiles").select("id,full_name,avatar_url").in("id", partners) : {data: []};

    const {data: ls} = await supabaseBrowser
      .from("listings")
      .select("id,title,price,images,seller_id,profiles(full_name)")
      .in("id", ids);

    const byId = new Map((ls || []).map((x: any) => [x.id, x]));
    const byProfile = new Map((ps || []).map((x: any) => [x.id, x]));
    const seen = new Set<string>();

    setInbox(
      (rows || [])
        .filter((x: any) => {
          const partner = x.sender_id === u.id ? x.receiver_id : x.sender_id;
          const key = x.listing_id + ":" + partner;
          if (!x.listing_id || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((x: any) => ({...x, listing: byId.get(x.listing_id), partner_id: x.sender_id === u.id ? x.receiver_id : x.sender_id, partner: byProfile.get(x.sender_id === u.id ? x.receiver_id : x.sender_id), unread: (rows || []).filter((m: any) => m.listing_id === x.listing_id && m.sender_id === (x.sender_id === u.id ? x.receiver_id : x.sender_id) && m.receiver_id === u.id && !m.read_at).length}))
        .filter((x: any) => x.listing)
    );
  }

  async function loadConversation(u: any, lid: string, partnerId?: string | null) {
    const {data: l} = await supabaseBrowser
      .from("listings")
      .select("id,title,price,images,seller_id,profiles(full_name)")
      .eq("id", lid)
      .maybeSingle();

    setListing(l);

    if (!l) {
      setMessages([]);
      return;
    }

    const {data} = await supabaseBrowser
      .from("messages")
      .select("id,sender_id,receiver_id,body,created_at,read_at")
      .eq("listing_id", lid)
      .or("sender_id.eq." + u.id + ",receiver_id.eq." + u.id)
      .order("created_at", {ascending: true});

    const conversation = (data || []).filter((m: any) => !partnerId || ((m.sender_id === u.id && m.receiver_id === partnerId) || (m.sender_id === partnerId && m.receiver_id === u.id)));
    setMessages(conversation);

    if (partnerId && partnerId !== u.id) {
      await supabaseBrowser.from("messages").update({read_at: new Date().toISOString()}).eq("listing_id", lid).eq("sender_id", partnerId).eq("receiver_id", u.id).is("read_at", null);
    }

    await supabaseBrowser
      .from("messages")
      .update({read_at: new Date().toISOString()})
      .eq("listing_id", lid)
      .eq("receiver_id", u.id)
      .is("read_at", null);
  }

  async function load() {
    const {data: {user: u}} = await supabaseBrowser.auth.getUser();
    setUser(u);

    if (!u) {
      setLoading(false);
      return;
    }

    const lid = getListingId();
    const partner = getPartnerId();

    if (lid) await loadConversation(u, lid, partner);
    else await loadInbox(u);

    setLoading(false);
  }

  useEffect(() => {
    let channel: any;

    (async () => {
      await load();

      const {data: {user: u}} = await supabaseBrowser.auth.getUser();
      const lid = getListingId();
      const partner = getPartnerId();

      if (!u) return;

      channel = supabaseBrowser
        .channel(lid ? "messages-listing-" + lid : "messages-inbox-" + u.id)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
            filter: lid
              ? "listing_id=eq." + lid
              : "receiver_id=eq." + u.id
          },
          async () => {
            if (lid) {
              await loadConversation(u, lid, partner);
            } else {
              await loadInbox(u);
            }
          }
        )
        .subscribe((status) => {
          setRealtime(status === "SUBSCRIBED");
        });
    })();

    return () => {
      if (channel) supabaseBrowser.removeChannel(channel);
    };
  }, []);

  async function send() {
    const body = text.trim();
    if (!body || !user || !listing || sending) return;

    const receiverId = getPartnerId() || (user.id === listing.seller_id
      ? messages.find((m) => m.sender_id !== user.id)?.sender_id
      : listing.seller_id);

    if (!receiverId || receiverId === user.id) {
      alert("Chưa có người mua để trả lời.");
      return;
    }

    setSending(true);

    const {error} = await supabaseBrowser.from("messages").insert({
      listing_id: listing.id,
      sender_id: user.id,
      receiver_id: receiverId,
      body
    });

    if (error) alert(error.message);
    else {
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
                <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">Trao đổi</p>
                <h1 className="mt-1 text-3xl font-black">Tin nhắn</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {realtime ? "Đang kết nối realtime" : "Đang kết nối..."}
                </p>
              </div>
              <MessageCircle className="text-brand-600" />
            </div>

            {loading ? (
              <div className="py-10 text-center text-slate-500">Đang tải...</div>
            ) : !inbox.length ? (
              <div className="card mt-6 p-10 text-center text-slate-500">
                Bạn chưa có cuộc trò chuyện nào.
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {inbox.map((x) => (
                  <Link
                    key={x.id}
                    href={"/tin-nhan?listing=" + encodeURIComponent(x.listing_id) + "&with=" + encodeURIComponent(x.partner_id)}
                    className="card flex gap-4 p-4 hover:shadow-soft"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {x.listing.images?.[0] && (
                        <img src={x.listing.images[0]} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3"><h2 className="truncate font-black">{x.listing.title}</h2>{x.unread > 0 && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-1 text-[10px] font-black text-white">{x.unread}</span>}</div><p className="mt-1 truncate text-xs font-bold text-brand-700">{x.partner?.full_name || "Người dùng"}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">{x.body}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(x.created_at).toLocaleString("vi-VN")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <Link href="/tin-nhan" className="text-sm font-bold text-brand-700">
              ← Tất cả tin nhắn
            </Link>

            {loading ? (
              <div className="py-10 text-center text-slate-500">Đang tải...</div>
            ) : !listing ? (
              <div className="card mt-5 p-10 text-center">Không tìm thấy tin.</div>
            ) : (
              <div className="mx-auto mt-5 max-w-2xl card overflow-hidden">
                <div className="border-b p-5">
                  <p className="text-xs font-bold text-brand-600">TRAO ĐỔI VỀ TIN</p>
                  <h1 className="mt-1 font-black">{listing.title}</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Người bán: {listing.profiles?.full_name || "Người bán"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {realtime ? "● Realtime đang hoạt động" : "○ Đang kết nối realtime"}
                  </p>
                </div>

                <div className="min-h-[360px] space-y-3 bg-slate-50 p-5">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={"flex " + (m.sender_id === user?.id ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={
                          "max-w-[80%] rounded-2xl px-4 py-3 text-sm " +
                          (m.sender_id === user?.id ? "bg-brand-600 text-white" : "border bg-white")
                        }
                      >
                        {m.body}
                        <div className="mt-1 text-[10px] opacity-60">
                          {new Date(m.created_at).toLocaleString("vi-VN")}
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
