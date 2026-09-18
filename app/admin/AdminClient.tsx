"use client";

import { useEffect, useState } from "react";
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
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("listings");
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const { data: auth } = await supabaseBrowser.auth.getUser();
    const user = auth.user;

    if (!user) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabaseBrowser
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      setAllowed(false);
      setLoading(false);
      return;
    }

    setAllowed(true);

    const [listingResult, reportResult, userResult, sellerRegistrationResult] = await Promise.all([
      supabaseBrowser
        .from("listings")
        .select(
          "id,title,price,price_type,images,status,created_at,rejection_reason,seller_id,category_id,location_id"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseBrowser
        .from("reports")
        .select("id,listing_id,reason,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseBrowser
        .from("profiles")
        .select("id,full_name,phone,avatar_url,role,created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseBrowser
        .from("seller_registrations")
        .select("id,user_id,store_name,category_id,location_id,phone,zalo_phone,status,rejection_reason,created_at,reviewed_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    if (listingResult.error || reportResult.error || userResult.error || sellerRegistrationResult.error) {
      setError(
        listingResult.error?.message ||
          reportResult.error?.message ||
          userResult.error?.message ||
          sellerRegistrationResult.error?.message ||
          "Không tải được dữ liệu quản trị."
      );
      setLoading(false);
      return;
    }

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
    const reportListingMap = new Map(
      (reportListingResult.data || []).map((x) => [x.id, x])
    );

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

    const sellerRows = sellerResult.data || [];
    const sellerCategoryIds = [...new Set(sellerRows.map((x) => x.category_id).filter(Boolean))];
    const sellerLocationIds = [...new Set(sellerRows.map((x) => x.location_id).filter(Boolean))];
    const [sc, sl] = await Promise.all([
      sellerCategoryIds.length ? supabaseBrowser.from("categories").select("id,name").in("id", sellerCategoryIds) : Promise.resolve({data: [] as any[]}),
      sellerLocationIds.length ? supabaseBrowser.from("locations").select("id,name").in("id", sellerLocationIds) : Promise.resolve({data: [] as any[]}),
    ]);
    const scm = new Map((sc.data || []).map((x) => [x.id, x.name]));
    const slm = new Map((sl.data || []).map((x) => [x.id, x.name]));
    setSellers(sellerRows.map((x) => ({...x, category_name: scm.get(x.category_id) || "Khác", location_name: slm.get(x.location_id) || "Phú Thọ"})));
    setUsers(userResult.data || []);
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

  async function sellerStatus(id: string, status: "approved" | "rejected") {
    let rejectionReason: string | null = null;
    if (status === "rejected") rejectionReason = window.prompt("Lý do từ chối đăng ký nhà bán hàng:") || "Thông tin đăng ký chưa đáp ứng yêu cầu.";
    const { error: updateError } = await supabaseBrowser.from("seller_registrations").update({ status, rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (updateError) { window.alert(updateError.message); return; }
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

  async function updateUser(user: any) {
    const nameInput = document.getElementById(
      "name-" + user.id
    ) as HTMLInputElement | null;
    const phoneInput = document.getElementById(
      "phone-" + user.id
    ) as HTMLInputElement | null;

    const name = nameInput?.value.trim() || null;
    const phone = phoneInput?.value.trim() || null;

    const { error: updateError } = await supabaseBrowser
      .from("profiles")
      .update({ full_name: name, phone })
      .eq("id", user.id);

    if (updateError) {
      window.alert(updateError.message);
      return;
    }

    window.alert("Đã cập nhật hồ sơ.");
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
        <p className="mt-2 text-slate-500">
          Khu vực này chỉ dành cho quản trị viên.
        </p>
      </div>
    );
  }

  const pending = rows.filter((x) => x.status === "pending").length;
  const published = rows.filter((x) => x.status === "published").length;
  const rejected = rows.filter((x) => x.status === "rejected").length;
  const shownRows =
    filter === "all" ? rows : rows.filter((x) => x.status === filter);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">
            Quản trị
          </p>
          <h1 className="mt-1 text-3xl font-black">Bảng điều khiển</h1>
        </div>

        <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setTab("listings")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "listings" ? "bg-white shadow" : "")}>
            Tin đăng
          </button>
          <button type="button" onClick={() => setTab("reports")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "reports" ? "bg-white shadow" : "")}>
            Báo cáo ({reports.length})
          </button>
          <button type="button" onClick={() => setTab("users")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "users" ? "bg-white shadow" : "")}>
            Người dùng ({users.length})
          </button>
          <button type="button" onClick={() => setTab("sellers")} className={"rounded-lg px-4 py-2 text-sm font-bold " + (tab === "sellers" ? "bg-white shadow" : "")}>
            Nhà bán hàng ({sellers.filter((x) => x.status === "pending").length})
          </button>
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
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value as Filter)}
                  className={"rounded-lg px-3 py-2 text-xs font-extrabold " + (filter === value ? "bg-brand-600 text-white" : "bg-white text-slate-600")}
                >
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
                        {image ? (
                          <img src={image} alt={row.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center px-2 text-center text-[11px] text-slate-400">
                            Không có ảnh
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="break-words font-extrabold">{row.title}</h2>
                        <p className="mt-1 text-sm font-bold text-brand-700">
                          {row.price_type === "contact"
                            ? "Liên hệ"
                            : new Intl.NumberFormat("vi-VN").format(row.price || 0) + " đ"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {row.categories?.name || "Chưa có danh mục"} ·{" "}
                          {row.locations?.name || "Chưa có khu vực"} ·{" "}
                          {row.profiles?.full_name || "Người bán"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(row.created_at).toLocaleString("vi-VN")}
                        </p>
                        {row.rejection_reason && (
                          <p className="mt-1 text-xs text-red-600">
                            Lý do: {row.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                        {statusLabel[row.status] || row.status}
                      </span>
                      <Link href={"/tin?id=" + row.id} className="rounded-lg border px-3 py-2 text-xs font-bold">
                        Xem tin
                      </Link>
                      {row.status === "pending" && (
                        <>
                          <button type="button" onClick={() => setStatus(row.id, "published")} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">
                            Duyệt
                          </button>
                          <button type="button" onClick={() => setStatus(row.id, "rejected")} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                            Từ chối
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {!shownRows.length && (
                <div className="p-10 text-center text-slate-500">
                  Không có tin ở trạng thái này.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      
      {tab === "sellers" && (
        <section className="card mt-7 overflow-hidden">
          <div className="border-b bg-slate-50 p-4"><h2 className="font-black">Đăng ký nhà bán hàng</h2><p className="mt-1 text-sm text-slate-500">Kiểm tra và duyệt hồ sơ trước khi người bán được đăng sản phẩm.</p></div>
          <div className="divide-y">
            {sellers.map((seller) => (
              <div key={seller.id} className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-black">{seller.store_name}</h3>
                    <p className="mt-1 text-sm text-slate-600">Danh mục: {seller.category_name} · Khu vực: {seller.location_name}</p>
                    <p className="mt-1 text-sm text-slate-500">SĐT: {seller.phone}{seller.zalo_phone ? " · Zalo: " + seller.zalo_phone : ""}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(seller.created_at).toLocaleString("vi-VN")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-full px-3 py-1 text-xs font-bold " + (seller.status === "approved" ? "bg-brand-50 text-brand-700" : seller.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700")}>{seller.status === "approved" ? "Đã duyệt" : seller.status === "rejected" ? "Từ chối" : "Chờ duyệt"}</span>
                    {seller.status === "pending" && <><button type="button" onClick={() => sellerStatus(seller.id, "approved")} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Duyệt nhà bán hàng</button><button type="button" onClick={() => sellerStatus(seller.id, "rejected")} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Từ chối</button></>}
                  </div>
                </div>
                {seller.rejection_reason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">Lý do: {seller.rejection_reason}</p>}
              </div>
            ))}
            {!sellers.length && <div className="p-10 text-center text-slate-500">Chưa có đăng ký nhà bán hàng.</div>}
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
                    <h2 className="font-extrabold">
                      {report.listings?.title || "Tin đã xóa"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Lý do: {report.reason || "Không nêu lý do"} ·{" "}
                      {new Date(report.created_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
                      {report.status || "pending"}
                    </span>
                    {report.status !== "resolved" && (
                      <button type="button" onClick={() => reportStatus(report.id)} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">
                        Đã xử lý
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {!reports.length && (
              <div className="p-10 text-center text-slate-500">
                Chưa có báo cáo.
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="card mt-7 overflow-hidden">
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center">👤</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">
                      {user.full_name || "Chưa có tên"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {user.phone || "Chưa có SĐT"} · {user.role || "user"}
                    </p>
                  </div>

                  <input
                    id={"name-" + user.id}
                    defaultValue={user.full_name || ""}
                    placeholder="Họ tên"
                    className="rounded-lg border px-3 py-2 text-sm md:w-48"
                  />
                  <input
                    id={"phone-" + user.id}
                    defaultValue={user.phone || ""}
                    placeholder="Số điện thoại"
                    className="rounded-lg border px-3 py-2 text-sm md:w-48"
                  />
                  <button
                    type="button"
                    onClick={() => updateUser(user)}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-extrabold text-white"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            ))}

            {!users.length && (
              <div className="p-10 text-center text-slate-500">
                Chưa có người dùng.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
