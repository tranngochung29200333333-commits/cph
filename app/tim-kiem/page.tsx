"use client";
import Link from "next/link";
import Header from "../../components/Header";
import {useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "../../lib/supabase-browser";
const money=new Intl.NumberFormat("vi-VN");
const conditions:[string,string][]=[["","Tất cả tình trạng"],["new","Mới"],["like_new","Như mới"],["used","Đã sử dụng"]];
export default function SearchPage(){
 const[items,setItems]=useState<any[]>([]),[cats,setCats]=useState<any[]>([]),[locs,setLocs]=useState<any[]>([]);
 const[q,setQ]=useState(""),[cat,setCat]=useState(""),[loc,setLoc]=useState(""),[condition,setCondition]=useState(""),[min,setMin]=useState(""),[max,setMax]=useState(""),[sort,setSort]=useState("new");
 const[loading,setLoading]=useState(true);
 async function load(){
  setLoading(true);
  let query=supabaseBrowser.from("listings").select("id,title,price,images,condition,created_at,locations(name),categories(name,slug)").eq("status","published");
  const term=q.trim(); if(term) query=query.or("title.ilike.%"+term+"%,description.ilike.%"+term+"%");
  if(cat) query=query.eq("category_id",cat); if(loc) query=query.eq("location_id",loc);
  if(condition) query=query.eq("condition",condition); if(min) query=query.gte("price",Number(min)); if(max) query=query.lte("price",Number(max));
  query=query.order("created_at",{ascending:false}); if(sort==="price_asc") query=query.order("price",{ascending:true}); if(sort==="price_desc") query=query.order("price",{ascending:false});
  const{data}=await query.limit(60); setItems(data||[]); setLoading(false);
 }
 useEffect(()=>{const p=new URLSearchParams(window.location.search);setQ(p.get("q")||"");Promise.all([
  supabaseBrowser.from("categories").select("id,name,slug").order("name"),
  supabaseBrowser.from("locations").select("id,name,level").eq("level","area").order("name")
 ]).then(([c,l])=>{setCats(c.data||[]);setLocs(l.data||[])});},[]);
 useEffect(()=>{const t=setTimeout(load,150);return()=>clearTimeout(t)},[q,cat,loc,condition,min,max,sort]);
 const title=useMemo(()=>q?"Kết quả cho “"+q+"”":"Tất cả tin đăng",[q]);
 return <main><Header/><section className="container-page py-8">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-extrabold uppercase tracking-widest text-brand-600">Mua bán</p><h1 className="mt-1 text-3xl font-black">{title}</h1><p className="mt-2 text-sm text-slate-500">{items.length} tin phù hợp</p></div><Link href="/dang-tin" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-white">+ Đăng tin</Link></div>
  <div className="card mt-6 p-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
   <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm sản phẩm..." className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-brand-500"/>
   <select value={cat} onChange={e=>setCat(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Tất cả danh mục</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <select value={loc} onChange={e=>setLoc(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">Tất cả khu vực</option>{locs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
   <select value={condition} onChange={e=>setCondition(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">{conditions.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>
   <input value={min} onChange={e=>setMin(e.target.value.replace(/\D/g,""))} inputMode="numeric" placeholder="Giá từ (đ)" className="rounded-xl border px-3 py-2.5 text-sm"/>
   <input value={max} onChange={e=>setMax(e.target.value.replace(/\D/g,""))} inputMode="numeric" placeholder="Giá đến (đ)" className="rounded-xl border px-3 py-2.5 text-sm"/>
   <select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm"><option value="new">Mới đăng</option><option value="price_asc">Giá thấp → cao</option><option value="price_desc">Giá cao → thấp</option></select>
   <button onClick={()=>{setQ("");setCat("");setLoc("");setCondition("");setMin("");setMax("");setSort("new")}} className="rounded-xl border px-3 py-2.5 text-sm font-bold">Xóa bộ lọc</button>
  </div></div>
  {loading?<div className="py-12 text-center text-slate-500">Đang tìm tin...</div>:<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map(x=><Link href={"/tin?id="+x.id} key={x.id} className="group overflow-hidden rounded-2xl border bg-white hover:shadow-soft"><div className="aspect-[4/3] overflow-hidden bg-slate-100">{x.images?.[0]?<img src={x.images[0]} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>:<div className="grid h-full place-items-center text-slate-400">Không có ảnh</div>}</div><div className="p-4"><h2 className="line-clamp-2 min-h-10 text-sm font-bold">{x.title}</h2><p className="mt-2 text-lg font-black text-brand-700">{money.format(x.price)} đ</p><p className="mt-2 text-xs text-slate-500">{x.categories?.name||"Khác"} · {x.locations?.name||"Phú Thọ"}</p></div></Link>)}{!items.length&&<div className="card col-span-full p-10 text-center text-slate-500">Chưa có tin phù hợp. Hãy thử đổi từ khóa hoặc bộ lọc.</div>}</div>}
 </section></main>
}