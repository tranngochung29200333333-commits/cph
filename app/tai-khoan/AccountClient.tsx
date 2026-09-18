"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabaseBrowser} from "../../lib/supabase-browser";
import AuthGuard from "../../components/AuthGuard";

const money=new Intl.NumberFormat("vi-VN");
const labels:Record<string,string>={published:"Đang hiển thị",pending:"Chờ duyệt",sold:"Đã bán",rejected:"Từ chối"};

export default function AccountClient(){
  const[items,setItems]=useState<any[]>([]); const[user,setUser]=useState<any>(null); const[loading,setLoading]=useState(true); const[action,setAction]=useState("");
  async function load(){
    setLoading(true);
    const{data:{user:u}}=await supabaseBrowser.auth.getUser(); setUser(u);
    if(u){const{data}=await supabaseBrowser.from("listings").select("id,title,price,status,created_at,rejection_reason").eq("seller_id",u.id).order("created_at",{ascending:false});setItems(data||[])}
    setLoading(false);
  }
  useEffect(()=>{load()},[]);
  async function changeStatus(id:string,status:"sold"|"pending"){
    setAction(id+status);
    const{error}=await supabaseBrowser.from("listings").update({status,rejection_reason:null}).eq("id",id);
    if(error) alert(error.message); else await load();
    setAction("");
  }
  async function remove(id:string){
    if(!confirm("Bạn chắc chắn muốn xóa tin này?")) return;
    setAction(id+"delete");
    const{error}=await supabaseBrowser.from("listings").delete().eq("id",id);
    if(error) alert(error.message); else await load();
    setAction("");
  }
  async function signout(){await supabaseBrowser.auth.signOut();window.location.href=window.location.origin+window.location.pathname.replace(/\/tai-khoan\/?$/,"/");}
  return <AuthGuard>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">Tài khoản</p><h1 className="mt-1 text-3xl font-black">Quản lý tin của tôi</h1><p className="mt-2 text-slate-500">{user?.email}</p></div>
      <div className="flex gap-2"><Link href="/dang-tin" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-white">+ Đăng tin</Link><button onClick={signout} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">Đăng xuất</button></div>
    </div>
    <div className="card mt-7 overflow-hidden">
      {loading?<div className="p-8">Đang tải...</div>:!items.length?<div className="p-10 text-center text-slate-500">Bạn chưa có tin đăng.</div>:
      <div className="divide-y">{items.map(x=><div key={x.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="font-extrabold">{x.title}</h2><p className="mt-1 text-sm text-brand-700">{money.format(x.price)} đ</p><p className="mt-1 text-xs text-slate-400">{new Date(x.created_at).toLocaleDateString("vi-VN")}</p></div>
          <span className={"rounded-full px-3 py-1 text-xs font-bold "+(x.status==="published"?"bg-brand-50 text-brand-700":x.status==="rejected"?"bg-red-50 text-red-600":"bg-slate-100 text-slate-600")}>{labels[x.status]||x.status}</span>
        </div>
        {x.rejection_reason&&<div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"><b>Lý do từ chối:</b> {x.rejection_reason}</div>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={"/sua-tin?id="+x.id} className="rounded-lg border px-3 py-2 text-xs font-bold">Sửa tin</Link>
          {x.status==="published"&&<button disabled={action===x.id+"sold"} onClick={()=>changeStatus(x.id,"sold")} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">Đánh dấu đã bán</button>}
          {x.status==="sold"&&<button disabled={action===x.id+"pending"} onClick={()=>changeStatus(x.id,"pending")} className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700">Đăng bán lại</button>}
          {x.status==="rejected"&&<button disabled={action===x.id+"pending"} onClick={()=>changeStatus(x.id,"pending")} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">Gửi duyệt lại</button>}
          <button disabled={action===x.id+"delete"} onClick={()=>remove(x.id)} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">Xóa</button>
        </div>
      </div>)}</div>}
    </div>
  </AuthGuard>
}