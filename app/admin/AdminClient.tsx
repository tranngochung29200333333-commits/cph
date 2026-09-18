"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase-browser";

type Tab = "listings" | "reports" | "users" | "sellers";
type Filter = "pending" | "published" | "rejected" | "sold" | "all";

const statusLabel: Record<string, string> = {
  pending: "Chờ duyệt",
  published: "Đang hiển thị",
  rejected: "Từ chối",
  sold: "Đã bán",
};

export default function AdminClient() {
  const [rows, setRows] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [sellerCategories, setSellerCategories] = useState<any[]>([]);
  const [sellerLocations, setSellerLocations] = useState<any[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("listings");
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabaseBrowser.auth.getUser();
    const currentUser = auth.user;

    if (!currentUser) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabaseBrowser
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const [listingResult, reportResult, adminUsersResult] = await Promise.all([
      supabaseBrowser
        .from("listings")
        .select("id,title,price,price_type,images,status,created_at,rejection_reason,seller_id,category_id,location_id")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseBrowser
        .from("reports")
        .select("id,listing_id,reason,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseBrowser.functions.invoke("admin-users", { body: { action: "list" } }),
    ]);

    if (listingResult.error || reportResult.error || adminUsersResult.error) {
      setError(
        listingResult.error?.message ||
          reportResult.error?.message ||
          adminUsersResult.error?.message ||
          "Không tải được dữ liệu quản trị."
      );
      setLoading(false);
      return;
    }

    const adminData = adminUsersResult.data || {};
    const accountRows = adminData.users || [];

    const listings = listingResult.data || [];
    const reportsData = reportResult.data || [];

    const sellerIds = [...new Set(listings.map((x) => x.seller_id).filter(Boolean))];
    const categoryIds = [...new Set(listings.map((x) => x.category_id).filter(Boolean))];
    const locationIds = [...new Set(listings.map((x) => x.location_id).filter(Boolean))];
    const reportListingIds = [...new Set(reportsData.map((x) => x.listing_id).filter(Boolean))];

    const [sellerResult, categoryResult, locationResult, reportListingResult] =
      await Promise.all([
        sellerIds.length
          ? supabaseBrowser.from("profiles").select("id,full_name").in("id", sellerIds)
          : Promise.resolve({ data: [] as any[] }),
        categoryIds.length
          ? supabaseBrowser.from("categories").select("id,name").in("id", categoryIds)
          : Promise.resolve({ data: [] as any[] }),
        locationIds.length
          ? supabaseBrowser.from("locations").select("id,name").in("id", locationIds)
          : Promise.resolve({ data: [] as any[] }),
        reportListingIds.length
          ? supabaseBrowser.from("listings").select("id,title").in("id", reportListingIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const sellerMap = new Map((sellerResult.data || []).map((x) => [x.id, x]));
    const categoryMap = new Map((categoryResult.data || []).map((x) => [x.id, x]));
    const locationMap = new Map((locationResult.data || []).map((x) => [x.id, x]));
    const reportListingMap = new Map((reportListingResult.data || []).map((x) => [x.id, x]));

    setRows(
      listings.map((x) => ({
        ...x,
        profiles: sellerMap.get(x.seller_id),
        categories: categoryMap.get(x.category_id),
        locations: locationMap.get(x.location_id),
      }))
    );

    setReports(
      reportsData.map((x) => ({
        ...x,
        listings: reportListingMap.get(x.listing_id),
      }))
    );

    const allCategories = adminData.categories || [];
    const allLocations = adminData.locations || [];
    const sellerRows = accountRows
      .filter((x: any) => ["pending", "approved"].includes(x.seller_registration?.status || ""))
      .map((x: any) => ({
        ...x.seller_registration,
        user_id: x.id,
        full_name: x.full_name,
        email: x.email,
        account_phone: x.phone,
        avatar_url: x.avatar_url,
        role: x.role,
        last_sign_in_at: x.last_sign_in_at,
        email_confirmed_at: x.email_confirmed_at,
      }));

    const userRows = accountRows.filter(
      (x: any) =>
        x.role !== "admin" &&
        !["pending", "approved"].includes(x.seller_registration?.status || "")
    );

    setSellers(sellerRows);
    setUsers(userRows);
    setSellerCategories(allCategories);
    setSellerLocations(allLocations);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: "published" | "rejected") {
    let rejectionReason: string | null = null;

    if (status === "rejected") {
      rejectionReason =
        window.prompt("Lý do từ chối tin:") ||
        "Nội dung chưa đáp ứng yêu cầu duyệt tin.";
    }

    const { error: updateError } = await supabaseBrowser
      .from("listings")
      .update({ status, rejection_reason: rejectionReason })
      .eq("id", id);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    await load();
  }

  async function updateAccount(user: any, sellerRegistration?: any) {
    const name = (document.getElementById("account-name-" + user.id) as HTMLInputElement | null)?.value.trim() || "";
    const phone = (document.getElementById("account-phone-" + user.id) as HTMLInputElement | null)?.value.trim() || "";
    const email = (document.getElementById("account-email-" + user.id) as HTMLInputElement | null)?.value.trim().toLowerCase() || "";

    const body: any = {
      action: "update_account",
      user_id: user.id,
      full_name: name,
      phone,
      email,
    };

    if (sellerRegistration) {
      body.seller_registration = {
        store_name: (document.getElementById("seller-store-" + user.id) as HTMLInputElement | null)?.value.trim() || "",
        phone: (document.getElementById("seller-phone-" + user.id) as HTMLInputElement | null)?.value.trim() || "",
        zalo_phone: (document.getElementById("seller-zalo-" + user.id) as HTMLInputElement | null)?.value.trim() || "",
        category_id: (document.getElementById("seller-category-" + user.id) as HTMLSelectElement | null)?.value || sellerRegistration.category_id,
        location_id: (document.getElementById("seller-location-" + user.id) as HTMLSelectElement | null)?.value || sellerRegistration.location_id,
      };
    }

    const { data, error: invokeError } = await supabaseBrowser.functions.invoke("admin-users", { body });
    if (invokeError || data?.error) {
      window.alert(invokeError?.message || data?.error || "Không thể cập nhật tài khoản.");
      return;
    }

    window.alert(sellerRegistration ? "Đã cập nhật hồ sơ nhà bán hàng." : "Đã cập nhật hồ sơ người dùng.");
    setEditingUserId(null);
    setEditingSellerId(null);
    await load();
  }

  async function deleteAccount(user: any) {
    const ok = window.confirm(
      "Xóa tài khoản " +
        (user.full_name || user.email || "này") +
        "? Tài khoản đăng nhập và dữ liệu gắn với tài khoản sẽ bị xóa. Hành động này không thể hoàn tác."
    );
    if (!ok) return;

    const { data, error: invokeError } = await supabaseBrowser.functions.invoke("admin-users", {
      body: { action: "delete", user_id: user.id },
    });

    if (invokeError || data?.error) {
      window.alert(invokeError?.message || data?.error || "Không thể xóa tài khoản.");
      return;
    }

    window.alert("Đã xóa tài khoản.");
    await load();
  }

  async function changePassword(user: any) {
    const label = user.store_name || user.full_name || user.email || "tài khoản này";
    const password = window.prompt(
      "Nhập mật khẩu mới cho " + label + ". Mật khẩu tối thiểu 8 ký tự:"
    );
    if (password === null) return;
    if (password.length < 8) {
      window.alert("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    const confirmPassword = window.prompt("Nhập lại mật khẩu mới để xác nhận:");
    if (confirmPassword === null) return;
    if (password !== confirmPassword) {
      window.alert("Hai lần nhập mật khẩu không giống nhau.");
      return;
    }

    const { data, error: invokeError } = await supabaseBrowser.functions.invoke("admin-users", {
      body: { action: "update_password", user_id: user.id || user.user_id, password },
    });

    if (invokeError || data?.error) {
      window.alert(invokeError?.message || data?.error || "Không thể đổi mật khẩu.");
      return;
    }

    window.alert("Đã đổi mật khẩu. Hãy gửi mật khẩu mới cho người dùng qua kênh riêng tư.");
  }

  async function sellerStatus(id: string, status: "approved" | "rejected") {
    let rejectionReason: string | null = null;
    if (status === "rejected") {
      rejectionReason =
        window.prompt("Lý do từ chối đăng ký nhà bán hàng:") ||
        "Thông tin đăng ký chưa đáp ứng yêu cầu.";
    }

    const { error: updateError } = await supabaseBrowser
      .from("seller_registrations")
      .update({
        status,
        rejection_reason: rejectionReason,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    await load();
  }

  async function reportStatus(id: string) {
    const { error: updateError } = await supabaseBrowser
      .from("reports")
      .update({ status: "resolved" })
      .eq("id", id);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    await load();
  }

  if (loading) {
    return <div>Đang tải quản trị...</div>;
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">Không tải được dữ liệu quản trị</h1>
        <p className="mt-2 text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-xl bg-brand-600 px-4 py-2 font-bold text-white"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-2xl font-black">Không có quyền truy cập</h1>
        <p className="mt-2 text-slate-500">Khu vực này chỉ dành cho quản trị viên.</p>
      </div>
    );
  }

  const pending = rows.filter((x) => x.status === "pending").length;
  const published = rows.filter((x) => x.status === "published").length;
  const rejected = rows.filter((x) => x.status === "rejected").length;
  const shownRows = filter === "all" ? rows : rows.filter((x) => x.status === filter);
  const pendingSellers = sellers.filter((x) => x.status === "pending").length;
  const approvedSellers = sellers.filter((x) => x.status === "approved").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">Quản trị</p>
          <h1 className="mt-1 text-3xl font-black">Bảng điều khiển</h1>
        </div>

        <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setTab("listings")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "listings" ? "bg-white shadow" : "")}>Tin đăng</button>
          <button type="button" onClick={() => setTab("reports")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "reports" ? "bg-white shadow" : "")}>Báo cáo ({reports.length})</button>
          <button type="button" onClick={() => setTab("users")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "users" ? "bg-white shadow" : "")}>Người dùng ({users.length})</button>
          <button type="button" onClick={() => setTab("sellers")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "sellers" ? "bg-white shadow" : "")}>Nhà bán hàng ({pendingSellers})</button>
        </div>
      </div>

      {tab === "listings" && (
        <section>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => setFilter("pending")} className={"card p-4 text-left " + (filter === "pending" ? "ring-2 ring-brand-500" : "")}>
              <p className="text-xs font-bold text-slate-500">Cần duyệt</p>
              <p className="mt-1 text-2xl font-black text-amber-600">{pending}</p>
            </button>
            <button type="button" onClick={() => setFilter("published")} className={"card p-4 text-left " + (filter === "published" ? "ring-2 ring-brand-500" : "")}>
              <p className="text-xs font-bold text-slate-500">Đang hiển thị</p>
              <p className="mt-1 text-2xl font-black text-brand-700">{published}</p>
            </button>
            <button type="button" onClick={() => setFilter("rejected")} className={"card p-4 text-left " + (filter === "rejected" ? "ring-2 ring-brand-500" : "")}>
              <p className="text-xs font-bold text-slate-500">Từ chối</p>
              <p className="mt-1 text-2xl font-black text-red-600">{rejected}</p>
            </button>
          </div>

          <div className="card mt-5 overflow-hidden">
            <div className="flex flex-wrap gap-2 border-b bg-slate-50 p-3">
              {[
                ["pending", "Chờ duyệt"],
                ["published", "Đang hiển thị"],
                ["rejected", "Từ chối"],
                ["sold", "Đã bán"],
                ["all", "Tất cả"],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value as Filter)} className={"rounded-lg px-3 py-2 text-xs font-extrabold " + (filter === value ? "bg-brand-600 text-white" : "bg-white text-slate-600")}>
                  {label} ({value === "all" ? rows.length : rows.filter((x) => x.status === value).length})
                </button>
              ))}
            </div>

            <div className="divide-y">
              {shownRows.map((row) => {
                const image = row.images?.[0];
                return (
                  <div key={row.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {image ? <img src={image} alt={row.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center px-2 text-center text-[11px] text-slate-400">Không có ảnh</div>}
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words font-extrabold">{row.title}</h2>
                        <p className="mt-1 text-sm font-bold text-brand-700">{row.price_type === "contact" ? "Liên hệ" : new Intl.NumberFormat("vi-VN").format(row.price || 0) + " đ"}</p>
                        <p className="mt-1 text-sm text-slate-500">{row.categories?.name || "Chưa có danh mục"} · {row.locations?.name || "Chưa có khu vực"} · {row.profiles?.full_name || "Người bán"}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(row.created_at).toLocaleString("vi-VN")}</p>
                        {row.rejection_reason && <p className="mt-1 text-xs text-red-600">Lý do: {row.rejection_reason}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[row.status] || row.status}</span>
                      <Link href={"/tin?id=" + row.id} className="rounded-lg border px-3 py-2 text-xs font-bold">Xem tin</Link>
                      {row.status === "pending" && (
                        <>
                          <button type="button" onClick={() => setStatus(row.id, "published")} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Duyệt</button>
                          <button type="button" onClick={() => setStatus(row.id, "rejected")} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Từ chối</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {!shownRows.length && <div className="p-10 text-center text-slate-500">Không có tin ở trạng thái này.</div>}
            </div>
          </div>
        </section>
      )}

      {tab === "sellers" && (
        <section className="card mt-7 overflow-hidden">
          <div className="border-b bg-slate-50 p-4">
            <h2 className="font-black">Nhà bán hàng</h2>
            <p className="mt-1 text-sm text-slate-500">Tài khoản có hồ sơ nhà bán hàng sẽ tự động nằm ở đây; không còn nằm trong mục Người dùng khi hồ sơ đang chờ duyệt hoặc đã được duyệt.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Chờ duyệt: {pendingSellers}</span>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">Đã duyệt: {approvedSellers}</span>
            </div>
          </div>

          <div className="divide-y">
            {sellers.map((seller) => (
              <div key={seller.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black">{seller.store_name}</h3>
                      <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + (seller.status === "approved" ? "bg-brand-50 text-brand-700" : seller.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>
                        {seller.status === "approved" ? "Đã duyệt" : seller.status === "rejected" ? "Từ chối" : "Chờ duyệt"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p><b>Họ tên:</b> {seller.full_name || "Chưa có tên"}</p>
                      <p><b>SĐT:</b> {seller.account_phone || seller.phone || "Chưa có SĐT"}</p>
                      <p className="break-all"><b>Gmail:</b> {seller.email || "Chưa có email"}</p>
                      <p><b>Mật khẩu:</b> <span className="text-slate-500">Không thể hiển thị — Supabase chỉ lưu mật khẩu dưới dạng hash bảo mật.</span></p>
                      <p><b>Cửa hàng:</b> {seller.store_name}</p>
                      <p><b>Danh mục:</b> {seller.category_name}</p>
                      <p><b>Khu vực:</b> {seller.location_name}</p>
                      <p><b>Zalo:</b> {seller.zalo_phone || "Chưa có"}</p>
                    </div>

                    <p className="mt-2 text-xs text-slate-400">
                      Đăng ký: {new Date(seller.created_at).toLocaleString("vi-VN")}
                      {seller.last_sign_in_at ? " · Đăng nhập gần nhất: " + new Date(seller.last_sign_in_at).toLocaleString("vi-VN") : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[280px] lg:justify-end">
                    <button type="button" onClick={() => setEditingSellerId(editingSellerId === seller.user_id ? null : seller.user_id)} className="rounded-lg border px-3 py-2 text-xs font-bold">Sửa profile</button>
                    <button type="button" onClick={() => changePassword(seller)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white">Đổi mật khẩu</button>
                    {seller.status === "pending" && (
                      <>
                        <button type="button" onClick={() => sellerStatus(seller.id, "approved")} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Duyệt</button>
                        <button type="button" onClick={() => sellerStatus(seller.id, "rejected")} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Từ chối</button>
                      </>
                    )}
                    <button type="button" onClick={() => deleteAccount(seller)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Xóa tài khoản</button>
                  </div>
                </div>

                {editingSellerId === seller.user_id && (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-black">Chỉnh sửa tại khu vực quản trị</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-bold">Họ tên<input id={"account-name-" + seller.user_id} defaultValue={seller.full_name || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">Số điện thoại<input id={"account-phone-" + seller.user_id} defaultValue={seller.account_phone || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold md:col-span-2">Gmail đăng nhập<input id={"account-email-" + seller.user_id} defaultValue={seller.email || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">Tên cửa hàng<input id={"seller-store-" + seller.user_id} defaultValue={seller.store_name || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">SĐT nhà bán hàng<input id={"seller-phone-" + seller.user_id} defaultValue={seller.phone || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">Zalo<input id={"seller-zalo-" + seller.user_id} defaultValue={seller.zalo_phone || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">Danh mục<select id={"seller-category-" + seller.user_id} defaultValue={seller.category_id} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">{sellerCategories.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                      <label className="text-xs font-bold md:col-span-2">Khu vực<select id={"seller-location-" + seller.user_id} defaultValue={seller.location_id} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm">{sellerLocations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => updateAccount(seller, seller)} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white">Lưu thay đổi</button>
                      <button type="button" onClick={() => setEditingSellerId(null)} className="rounded-lg border bg-white px-4 py-2 text-xs font-bold">Hủy</button>
                    </div>
                  </div>
                )}

                {seller.rejection_reason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lý do: {seller.rejection_reason}</p>}
              </div>
            ))}
            {!sellers.length && <div className="p-10 text-center text-slate-500">Chưa có nhà bán hàng.</div>}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="card mt-7 overflow-hidden">
          <div className="border-b bg-slate-50 p-4">
            <h2 className="font-black">Người dùng</h2>
            <p className="mt-1 text-sm text-slate-500">Chỉ hiển thị khách đăng ký tài khoản. Khi đăng ký hồ sơ nhà bán hàng, tài khoản sẽ tự động chuyển sang mục Nhà bán hàng.</p>
            <p className="mt-2 text-xs text-slate-400">Admin có thể đặt lại mật khẩu khi khách quên. Mật khẩu cũ không được hiển thị.</p>
          </div>

          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center">👤</div>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold">{user.full_name || "Chưa có tên"}</p>
                      <p className="mt-1 break-all text-sm text-slate-600">{user.email || "Chưa có Gmail"}</p>
                      <p className="mt-1 text-sm text-slate-500">SĐT: {user.phone || "Chưa có SĐT"}</p>
                      <p className="mt-1 text-xs text-slate-400">{user.last_sign_in_at ? "Đăng nhập gần nhất: " + new Date(user.last_sign_in_at).toLocaleString("vi-VN") : "Chưa đăng nhập"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingUserId(editingUserId === user.id ? null : user.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">Sửa profile</button>
                    <button type="button" onClick={() => changePassword(user)} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white">Đổi mật khẩu</button>
                    <button type="button" onClick={() => deleteAccount(user)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Xóa tài khoản</button>
                  </div>
                </div>

                {editingUserId === user.id && (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-black">Sửa profile người dùng</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-bold">Họ tên<input id={"account-name-" + user.id} defaultValue={user.full_name || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold">Số điện thoại<input id={"account-phone-" + user.id} defaultValue={user.phone || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-bold md:col-span-2">Gmail đăng nhập<input id={"account-email-" + user.id} defaultValue={user.email || ""} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Mật khẩu không hiển thị trong quản trị. Hệ thống xác thực chỉ lưu hash mật khẩu, không lưu mật khẩu gốc.</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => updateAccount(user)} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white">Lưu thay đổi</button>
                      <button type="button" onClick={() => setEditingUserId(null)} className="rounded-lg border bg-white px-4 py-2 text-xs font-bold">Hủy</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {!users.length && <div className="p-10 text-center text-slate-500">Không có khách đăng ký tài khoản.</div>}
          </div>
        </section>
      )}

      {tab === "reports" && (
        <section className="card mt-7 overflow-hidden">
          <div className="divide-y">
            {reports.map((report) => (
              <div key={report.id} className="p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="font-extrabold">{report.listings?.title || "Tin đã xóa"}</h2>
                    <p className="mt-1 text-sm text-slate-500">Lý do: {report.reason || "Không nêu lý do"} · {new Date(report.created_at).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{report.status || "pending"}</span>
                    {report.status !== "resolved" && <button type="button" onClick={() => reportStatus(report.id)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Đã xử lý</button>}
                  </div>
                </div>
              </div>
            ))}
            {!reports.length && <div className="p-10 text-center text-slate-500">Chưa có báo cáo.</div>}
          </div>
        </section>
      )}
    </div>
  );
}
