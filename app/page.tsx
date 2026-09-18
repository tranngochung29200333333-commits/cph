"use client";

import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck, Smartphone, Store, Zap } from "lucide-react";
import Header from "../components/Header";
import SearchBox from "../components/SearchBox";
import CategoryCard from "../components/CategoryCard";
import { supabaseBrowser } from "../lib/supabase-browser";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

type Seller = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  listingCount: number;
  latestTitle: string;
  latestImage: string | null;
};


export default function Home() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: categoryData } = await supabaseBrowser
        .from("categories")
        .select("id,name,slug,icon")
        .order("name");

      const allCategories = (categoryData || []) as Category[];
      const { data: listingData } = await supabaseBrowser
        .from("listings")
        .select("id,seller_id,title,images,created_at")
        .eq("status", "published")
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      const listings = listingData || [];

      const sellerIds = [...new Set(listings.map((item: any) => item.seller_id).filter(Boolean))];

      let profileData: any[] = [];
      if (sellerIds.length) {
        const { data } = await supabaseBrowser
          .from("profiles")
          .select("id,full_name,avatar_url")
          .in("id", sellerIds);
        profileData = data || [];
      }

      const profileMap = new Map(profileData.map((profile) => [profile.id, profile]));
      const grouped = new Map<string, Seller>();

      for (const item of listings) {
        if (!item.seller_id || grouped.has(item.seller_id)) {
          if (item.seller_id && grouped.has(item.seller_id)) {
            const seller = grouped.get(item.seller_id)!;
            seller.listingCount += 1;
          }
          continue;
        }

        const profile = profileMap.get(item.seller_id);
        grouped.set(item.seller_id, {
          id: item.seller_id,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          listingCount: 1,
          latestTitle: item.title,
          latestImage: item.images?.[0] || null,
        });
      }

      if (active) {
        setCategories(allCategories);
        setSellers([...grouped.values()].slice(0, 8));
      }
    };

    load();
    const timer = window.setInterval(load, 15000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main>
      <Header />

      <section className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,35,24,.94),rgba(4,35,24,.56),rgba(4,35,24,.18)),url('https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1800&q=85')] bg-cover bg-center" />
        <div className="relative container-page py-20 md:py-28">
          <div className="max-w-2xl text-white">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
              <MapPin size={14} />
              Mua bán tại Phú Thọ
            </div>
            <h1 className="text-balance text-4xl font-black leading-tight md:text-6xl">
              Mua bán, dịch vụ và địa điểm tại Phú Thọ
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80 md:text-lg">
              Tìm nhà bán hàng, sản phẩm và dịch vụ gần bạn. Xem hồ sơ người bán để biết các sản phẩm đang có.
            </p>
            <div className="mt-7">
              <SearchBox />
            </div>
          </div>
        </div>
      </section>

      <section id="danh-muc" className="container-page py-10 md:py-14">
        <div className="card p-5 md:p-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
                Khám phá
              </p>
              <h2 className="mt-1 text-2xl font-black md:text-3xl">
                Danh mục phổ biến
              </h2>
            </div>
            <Link
              href="/danh-muc"
              className="shrink-0 rounded-xl bg-brand-50 px-3 py-2 text-sm font-extrabold text-brand-700 hover:bg-brand-100"
            >
              {categories.length} danh mục · Xem tất cả →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {categories.slice(0, 10).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-12 md:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
                  Nhà bán hàng
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Nhà bán hàng
                </h2>
              </div>
              <Link href="/danh-muc" className="text-sm font-bold text-brand-700">
                Xem danh mục →
              </Link>
            </div>

            {!sellers.length ? (
              <div className="card p-8 text-center text-slate-500">
                Chưa có nhà bán hàng đang hoạt động.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {sellers.map((seller) => (
                  <Link
                    key={seller.id}
                    href={"/nguoi-ban?id=" + encodeURIComponent(seller.id)}
                    className="group overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-soft"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                      {seller.latestImage ? (
                        <img
                          src={seller.latestImage}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-4xl">
                          🏪
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border bg-slate-100">
                          {seller.avatar_url ? (
                            <img
                              src={seller.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-lg">
                              👤
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-black">
                            {seller.full_name || "Nhà bán hàng"}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-brand-700">
                            {seller.listingCount} sản phẩm đang bán
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-2 text-xs text-slate-500">
                        {seller.latestTitle}
                      </p>

                      <div className="mt-3 flex items-center gap-1 text-xs font-extrabold text-brand-700">
                        Xem profile & sản phẩm <ArrowRight size={14} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-2xl bg-brand-700 p-6 text-white shadow-soft">
              <Zap size={28} />
              <h3 className="mt-4 text-xl font-black">Đăng tin miễn phí</h3>
              <p className="mt-2 text-sm leading-6 text-white/80">
                Tạo hồ sơ nhà bán hàng và đăng các sản phẩm bạn đang kinh doanh.
              </p>
              <Link
                href="/dang-tin"
                className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-brand-700"
              >
                Đăng tin ngay
              </Link>
            </div>

            <div id="khu-vuc" className="card p-5">
              <h3 className="font-black">Khu vực Phú Thọ</h3>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[
                  "Việt Trì",
                  "Lâm Thao",
                  "Phù Ninh",
                  "Thanh Ba",
                  "Đoan Hùng",
                  "Hạ Hòa",
                  "Cẩm Khê",
                  "Thanh Sơn",
                  "Tân Sơn",
                  "Yên Lập",
                ].map((name) => {
                  const slug = ({
                    "Việt Trì": "viet-tri",
                    "Lâm Thao": "lam-thao",
                    "Phù Ninh": "phu-ninh",
                    "Thanh Ba": "thanh-ba",
                    "Đoan Hùng": "doan-hung",
                    "Hạ Hòa": "ha-hoa",
                    "Cẩm Khê": "cam-khe",
                    "Thanh Sơn": "thanh-son",
                    "Tân Sơn": "tan-son",
                    "Yên Lập": "yen-lap",
                  } as Record<string, string>)[name];

                  return (
                    <Link
                      key={name}
                      href={"/khu-vuc?slug=" + slug}
                      className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-brand-50">
        <div className="container-page py-10 md:py-14">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                i: Smartphone,
                t: "Hồ sơ nhà bán hàng",
                d: "Mỗi người bán có một profile riêng để khách xem thông tin và các sản phẩm đang bán.",
              },
              {
                i: ShieldCheck,
                t: "Dữ liệu an toàn",
                d: "Supabase Auth và RLS giúp kiểm soát dữ liệu tài khoản và tin đăng.",
              },
              {
                i: Store,
                t: "Đúng cộng đồng địa phương",
                d: "Kết nối người mua và người bán trong cùng khu vực Phú Thọ.",
              },
            ].map(({ i: Icon, t, d }) => (
              <div
                key={t}
                className="card flex min-h-[150px] flex-col gap-4 p-6 md:min-h-[180px]"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon size={21} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold md:text-lg">{t}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="container-page py-10">
          <div className="card grid gap-10 p-6 md:grid-cols-3 md:p-8">
            <div>
              <div className="font-black text-lg">PHÚ THỌ MARKET</div>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-500">
                Chợ online địa phương kết nối nhà bán hàng và khách hàng tại Phú Thọ.
              </p>
            </div>
            <div>
              <h3 className="font-black">Khám phá</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-500">
                <Link href="#danh-muc">Danh mục</Link>
                <Link href="#khu-vuc">Khu vực</Link>
                <Link href="/dang-tin">Đăng tin</Link>
              </div>
            </div>
            <div>
              <h3 className="font-black">Nhà bán hàng</h3>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Khách có thể vào profile từng nhà bán hàng để xem toàn bộ sản phẩm hiện đang được bán.
              </p>
            </div>
          </div>
        </div>
        <div className="border-t py-5 text-center text-xs text-slate-400">
          © 2026 Phú Thọ Market
        </div>
      </footer>
    </main>
  );
}
