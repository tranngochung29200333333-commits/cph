"use client";
import {Search} from "lucide-react";import {FormEvent,useState} from "react";import {useRouter} from "next/navigation";
export default function SearchBox(){
 const[q,setQ]=useState("");const router=useRouter();
 function submit(e:FormEvent){e.preventDefault();if(q.trim())router.push("/tim-kiem?q="+encodeURIComponent(q.trim()))}
 return <form onSubmit={submit} className="mx-auto flex min-w-0 max-w-3xl overflow-hidden rounded-2xl bg-white p-1.5 shadow-soft">
   <div className="flex min-w-0 flex-1 items-center gap-3 px-2 sm:px-3"><Search className="shrink-0 text-slate-400" size={21}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm iPhone, laptop, PC, màn hình..." className="min-w-0 w-full truncate py-3 text-sm outline-none"/></div>
   <button className="shrink-0 rounded-xl bg-brand-600 px-3 sm:px-6 py-2 text-sm font-black text-white">Tìm kiếm</button>
 </form>
}