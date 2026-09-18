"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";
import AuthGuard from "../../components/AuthGuard";
import { supabaseBrowser } from "../../lib/supabase-browser";
import Link from "next/link";

type FormState = {
  store_name: string;
  category_id: string;
  location_id: string;
  phone: string;
  zalo_phone: string;
};

export default function SellerRegistrationPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    store_name: "",
    category_id: "",
    location_id: "",
    phone: "",
    zalo_phone: "",
  });
  const [cats, setCats] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabaseBrowser.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [categories, locations, registration] = await Promise.all([
      supabaseBrowser.from("categories").select("id,name").order("name"),
      supabaseBrowser.from("locations").select("id,name").eq("level", "area").order("name"),
      supabaseBrowser.from("seller_registrations").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const queryError =
      categories.error?.message ||
      locations.error?.message ||
      registration.error?.message;

    if (queryError) {
      setError(queryError);
      setLoading(false);
      return;
    }

    setCats(categories.data || []);
    setLocs(locations.data || []);
    setCurrent(registration.data || null);

    if (registration.data) {
      setForm({
        store_name: registration.data.store_name || "",
        category_id: registration.data.category_id || "",
        location_id: registration.data.location_id || "",
        phone: registration.data.phone || "",
        zalo_phone: registration.data.zalo_phone || "",
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    setNotice("");

    const phone = form.phone.replace(/[ .-]/g, "");
    const zalo = form.zalo_phone.replace(/[ .-]/g, "");

    if (form.store_name.trim().length < 2) {
      setError("Tên cửa hàng cần ít nhất 2 ký tự.");
      return;
    }
    if (!form.category_id || !form.location_id) {
      setError("Vui lòng chọn danh mục bán và khu vực.");
      return;
    }
    if (!/^0\d{8,10}$/.test(phone)) {
      setError("Số điện thoại chưa đúng định dạng.");
      return;
    }
    if (zalo && !/^0\d{8,10}$/.test(zalo)) {
      setError("Số điện thoại Zalo chưa đúng định dạng.");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabaseBrowser.auth.getUser();
      if (!user) throw new Error("Bạn cần đăng nhập.");

      const payload = {
        user_id: user.id,
        store_name: form.store_name.trim(),
        category_id: form.category_id,
        location_id: form.location_id,
        phone,
        zalo_phone: zalo || null,
        status: "pending",
        rejection_reason: null,
      };

      const query = current
        ? supabaseBrowser.from("seller_registrations").update(payload).eq("id", current.id)
        : supabaseBrowser.from("seller_registrations").insert(payload);

      const { error: saveError } = await query;
      if (saveError) throw saveError;

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi đăng ký.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGuard>
      <main>
        <Header />
        <section className="container-page py-10">
          <div className="mx-auto max-w-2xl">
            <Link href="/tai-khoan" className="text-sm font-bold text-brand-700">
              ← Tài khoản
            </Link>

            <div className="mt-4">
              <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
                Nhà bán hàng
              </p>
              <h1 className="mt-1 text-3xl font-black">Đăng ký nhà bán hàng</h1>
              <p className="mt-2 text-slate-500">
                Thông tin này sẽ được dùng chung cho các sản phẩm bạn đăng bán.
              </p>
            </div>

            {loading ? (
              <div className="card mt-7 p-6 text-slate-500">Đang tải...</div>
            ) : current?.status === "approved" ? (
              <div className="card mt-7 p-6">
                <h2 className="text-xl font-black">Nhà bán hàng đã được duyệt</h2>
                <p className="mt-2 text-slate-600">{current.store_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Bạn có thể đăng sản phẩm. Danh mục, khu vực, số điện thoại và Zalo
                  sẽ tự động lấy từ hồ sơ này.
                </p>
                <Link
                  href="/dang-tin"
                  className="mt-5 inline-block rounded-xl bg-brand-600 px-4 py-2.5 font-extrabold text-white"
                >
                  Đăng sản phẩm
                </Link>
              </div>
            ) : current?.status === "pending" ? (
              <div className="card mt-7 p-6 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-2xl">⏳</div>
                <h2 className="mt-4 text-xl font-black">Hồ sơ nhà bán hàng của bạn đã được gửi.</h2>
                <p className="mt-2 text-slate-600">Đợi phê duyệt</p>
                <p className="mt-2 text-sm text-slate-500">Trong thời gian chờ duyệt, bạn chưa thể đăng sản phẩm.</p>
                <Link href="/" className="mt-5 inline-block rounded-xl bg-brand-600 px-4 py-2.5 font-extrabold text-white">Về trang chủ</Link>
              </div>
            ) : (
              <form onSubmit={submit} className="card mt-7 p-5 md:p-6">
                <label className="block text-sm font-bold">
                  Tên cửa hàng
                  <input
                    required
                    value={form.store_name}
                    onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                    placeholder="Ví dụ: Cửa hàng của tôi"
                    className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-bold">
                    Danh mục bán
                    <select
                      required
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className="mt-1 w-full rounded-xl border bg-white px-4 py-3 font-normal"
                    >
                      <option value="">Chọn danh mục</option>
                      {cats.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold">
                    Khu vực
                    <select
                      required
                      value={form.location_id}
                      onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                      className="mt-1 w-full rounded-xl border bg-white px-4 py-3 font-normal"
                    >
                      <option value="">Chọn khu vực</option>
                      {locs.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-bold">
                    Số điện thoại
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      inputMode="tel"
                      placeholder="09xx xxx xxx"
                      className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"
                    />
                  </label>

                  <label className="text-sm font-bold">
                    Số điện thoại Zalo
                    <input
                      value={form.zalo_phone}
                      onChange={(e) => setForm({ ...form, zalo_phone: e.target.value })}
                      inputMode="tel"
                      placeholder="09xx xxx xxx"
                      className="mt-1 w-full rounded-xl border px-4 py-3 font-normal"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Không bắt buộc
                    </span>
                  </label>
                </div>

                {current?.status === "pending" && (
                  <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                    Hồ sơ đang chờ admin duyệt.
                  </div>
                )}

                {current?.status === "rejected" && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    Hồ sơ trước đó bị từ chối. Bạn có thể sửa thông tin và gửi lại.
                  </div>
                )}

                {error && (
                  <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </p>
                )}

                {notice && (
                  <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving || current?.status === "pending"}
                  className="mt-5 rounded-xl bg-brand-600 px-5 py-3 font-extrabold text-white disabled:opacity-60"
                >
                  {saving
                    ? "Đang gửi..."
                    : current?.status === "pending"
                      ? "Đang chờ duyệt"
                      : "Gửi đăng ký"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
