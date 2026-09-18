"use client";

import {FormEvent,useEffect,useState} from "react";
import Link from "next/link";
import {supabaseBrowser} from "../../lib/supabase-browser";
import {useRouter} from "next/navigation";

export default function LoginForm(){
 const[email,setEmail]=useState("");
 const[password,setPassword]=useState("");
 const[error,setError]=useState("");
 const[loading,setLoading]=useState(false);
 const[checking,setChecking]=useState(true);
 const router=useRouter();

 useEffect(()=>{
   supabaseBrowser.auth.getSession().then(({data})=>{
     if(data.session) router.replace("/");
     else setChecking(false);
   });
 },[router]);

 async function submit(e:FormEvent){
   e.preventDefault(); if(loading)return;
   setLoading(true);setError("");
   const{data,error:loginError}=await supabaseBrowser.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
   if(loginError){
     const m=loginError.message.toLowerCase();
     setError(m.includes("email not confirmed")?"Email chưa được xác nhận. Nếu muốn khách đăng ký xong vào web ngay, hãy tắt Confirm email trong Supabase Auth.":loginError.message);
     setLoading(false);return;
   }
   if(data.session){router.replace("/");router.refresh();return}
   setError("Không tạo được phiên đăng nhập. Vui lòng thử lại.");
   setLoading(false);
 }

 if(checking)return <div className="mt-6 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Đang kiểm tra phiên đăng nhập...</div>;

 return <form onSubmit={submit} className="mt-6 space-y-3">
   <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" autoComplete="email" className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500"/>
   <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mật khẩu" autoComplete="current-password" className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand-500"/>
   <div className="text-right"><Link href="/dat-lai-mat-khau" className="text-sm font-bold text-brand-700">Quên mật khẩu?</Link></div>
   {error&&<p className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-600">{error}</p>}
   <button disabled={loading} className="w-full rounded-xl bg-brand-600 py-3 font-extrabold text-white disabled:opacity-60">{loading?"Đang đăng nhập...":"Đăng nhập"}</button>
 </form>
}