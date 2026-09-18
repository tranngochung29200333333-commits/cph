"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../../components/Header";
import { MapPin, Phone, UserRound, MessageCircle, ShoppingCart, Plus, Minus } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase-browser";

const money = new Intl.NumberFormat("vi-VN");

type Seller = {
  store_name: string;
  phone: string;
  zalo_phone: string | null;
  category_id: string;
  location_id: string;
  status: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type Item = {
  id: string;
  title: string;
  price: number;
  price_type: string;
  images: string[] | null;
  location_name: string;
};

export default function SellerPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [locationName, setLocationName] = useState("Phú Thọ");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [cart, setCart] = useState<any[]>([]);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem("ptmarket-cart") || "[]")); } catch { setCart([]); }
    const onCart = () => { try { setCart(JSON.parse(localStorage.getItem("ptmarket-cart") || "[]")); } catch { setCart([]); } };
    window.addEventListener("ptmarket-cart-updated", onCart);
    return () => window.removeEventListener("ptmarket-cart-updated", onCart);
  }, []);

  function cartQty(id: string) { return cart.find((i: any) => i.id === id)?.quantity || 0; }
  function updateCart(item: Item, quantity: number) {
    const next = cart.filter((i: any) => i.id !== item.id);
    if (quantity > 0) next.push({ id: item.id, title: item.title, price: item.price, price_type: item.price_type, image: item.images?.[0] || "", seller_id: profile?.id, quantity });
    setCart(next); localStorage.setItem("ptmarket-cart", JSON.stringify(next)); window.dispatchEvent(new Event("ptmarket-cart-updated"));
  }

  useEffect(() => {
    async function load() {
      const id = new URLSearchParams(window.location.search).get("id");
      const { data: authData } = await supabaseBrowser.auth.getUser();
      setCurrentUserId(authData.user?.id || null);

      if (!id) {
        setLoading(false);
        return;
      }

      const [profileResult, sellerResult] = await Promise.all([
        supabaseBrowser
          .from("profiles")
          .select("id,full_name,avatar_url,created_at")
          .eq("id", id)
          .maybeSingle(),
        supabaseBrowser
          .from("seller_registrations")
          .select("store_name,phone,zalo_phone,category_id,location_id,status")
          .eq("user_id", id)
          .eq("status", "approved")
          .maybeSingle(),
      ]);

      setProfile(profileResult.data);
      setSeller(sellerResult.data);

      if (sellerResult.data) {
        const sellerData = sellerResult.data;

        const { data: listings, error: listingsError } = await supabaseBrowser
          .from("listings")
          .select("id,title,price,price_type,images")
          .eq("seller_id", id)
          .eq("status", "published")
          .or(
            "expires_at.is.null,expires_at.gt." + new Date().toISOString()
          )
          .order("created_at", { ascending: false })
          .limit(60);

        if (!listingsError) {
          const [categoryResult, locationResult] = await Promise.all([
            sellerData.category_id
              ? supabaseBrowser
                  .from("categories")
                  .select("name")
                  .eq("id", sellerData.category_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            sellerData.location_id
              ? supabaseBrowser
                  .from("locations")
                  .select("name")
                  .eq("id", sellerData.location_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

          const nextCategoryName = categoryResult.data?.name || "";
          const nextLocationName =
            locationResult.data?.name || "Phú Thọ";

          setCategoryName(nextCategoryName);
          setLocationName(nextLocationName);

          setItems(
            (listings || []).map((item) => ({
              id: item.id,
              title: item.title,
              price: item.price || 0,
              price_type: item.price_type,
              images: item.images || [],
              location_name: nextLocationName,
            }))
          );
        }
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <main>
        <Header />
        <section className="container-page py-12 text-center text-slate-500">
          Đang tải hồ sơ...
        </section>
      </main>
    );
  }

  if (!profile || !seller) {
    return (
      <main>
        <Header />
        <section className="container-page py-12 text-center">
          <h1 className="text-2xl font-black">Không tìm thấy nhà bán hàng</h1>
          <p className="mt-2 text-slate-500">
            Nhà bán hàng chưa được duyệt hoặc hồ sơ không còn hoạt động.
          </p>
          <Link
            href="/danh-muc"
            className="mt-4 inline-block font-bold text-brand-700"
          >
            ← Về danh mục
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />

      <section className="container-page py-8">
        <Link
          href="/danh-muc"
          className="text-sm font-bold text-brand-700"
        >
          ← Quay lại danh mục
        </Link>

        <div className="card mt-5 p-6 md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                <UserRound size={38} />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
                Hồ sơ nhà bán hàng
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black">{seller.store_name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-extrabold text-brand-700">✓ Đã xác minh</span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Người đại diện: {profile.full_name || "Nhà bán hàng"} · Tham
                gia từ{" "}
                {new Date(profile.created_at).toLocaleDateString("vi-VN")}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Danh mục: {categoryName || "Sản phẩm"}
                </span>

                <span className="rounded-full bg-slate-100 px-3 py-1">
                  <MapPin size={13} className="mr-1 inline" />
                  {locationName}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {seller.phone && (
                  <a
                    href={"tel:" + seller.phone}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-white"
                  >
                    <Phone size={16} />
                    {seller.phone}
                  </a>
                )}

                {currentUserId && currentUserId !== profile.id && items.length > 0 && (
                  <Link
                    href={
                      "/tin-nhan?listing=" +
                      encodeURIComponent(items[0].id) +
                      "&with=" +
                      encodeURIComponent(profile.id)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white"
                  >
                    <MessageCircle size={16} />
                    Nhắn tin
                  </Link>
                )}

                {seller.zalo_phone && (
                  <a
                    href={
                      "https://zalo.me/" +
                      seller.zalo_phone.replace(/\D/g, "")
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#0068ff] px-4 py-2.5 text-sm font-extrabold text-white"
                  >
                    💬 Liên hệ Zalo
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
            Sản phẩm đang bán
          </p>

          <h2 className="mt-1 text-2xl font-black">
            {items.length} sản phẩm
          </h2>

          {items.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border bg-white hover:shadow-soft">
                  <Link href={"/tin?id=" + item.id + "&seller=" + encodeURIComponent(profile.id)} className="block">
                    <div className="aspect-[4/3] bg-slate-100">
                      {item.images?.[0] && <img src={item.images[0]} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="p-4 pb-2">
                      <h3 className="line-clamp-2 text-sm font-bold">{item.title}</h3>
                      <p className="mt-2 font-black text-brand-700">{item.price_type === "contact" ? "Liên hệ" : money.format(item.price) + " đ"}</p>
                      <p className="mt-2 text-xs text-slate-500">{item.location_name}</p>
                    </div>
                  </Link>
                  <div className="px-4 pb-4 pt-2">
                    {cartQty(item.id)>0 ? <div className="relative flex items-center justify-center rounded-xl bg-brand-50 p-2">
                      <span className="text-xs font-extrabold text-brand-700">Giỏ hàng</span>
                      <div className="inline-flex items-center rounded-lg border bg-white">
                        <button type="button" onClick={()=>updateCart(item,cartQty(item.id)-1)} className="grid h-8 w-8 place-items-center"><Minus size={14}/></button>
                        <span className="min-w-8 text-center text-sm font-black">{cartQty(item.id)}</span>
                        <button type="button" onClick={()=>updateCart(item,cartQty(item.id)+1)} className="grid h-8 w-8 place-items-center text-brand-700"><Plus size={14}/></button>
                      </div>
                    </div> : <button type="button" onClick={()=>updateCart(item,1)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-extrabold text-white"><ShoppingCart size={16}/> + Thêm giỏ hàng</button>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card mt-5 p-10 text-center text-slate-500">
              Nhà bán hàng chưa có sản phẩm đang hiển thị.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
