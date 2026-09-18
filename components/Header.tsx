"use client";

import Link from "next/link";
import {LogIn,Plus,Heart,MessageCircle,UserRound,Search,Home,LogOut,ArrowLeft} from "lucide-react";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import Logo from "./Logo";
import {supabaseBrowser} from "../lib/supabase-browser";

const mobileItems=[
  {href:"/",label:"Trang chủ",icon:Home},
  {href:"/yeu-thich",label:"Yêu thích",icon:Heart},
  {href:"/tin-nhan",label:"Tin nhắn",icon:MessageCircle},
  {href:"/tai-khoan",label:"Tài khoản",icon:UserRound},
];

function MessageIcon({unread=false}:{unread?:boolean}) {
  return <span className="relative inline-flex"><MessageCircle size={19}/>{unread&&<span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-black leading-4 text-white">!</span>}</span>;
}

export default function Header(){
  const pathname=usePathname();
  const[user,setUser]=useState<any>(null);
  const[unread,setUnread]=useState(false);
  const[ready,setReady]=useState(false);
  const[isAdmin,setIsAdmin]=useState(false);
  const[isVerifiedSeller,setIsVerifiedSeller]=useState(false);

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      const{data:{user:u}}=await supabaseBrowser.auth.getUser();
      if(active){setUser(u);setReady(true)}
      if(!u){if(active){setUnread(false);setIsAdmin(false);setIsVerifiedSeller(false)}return}
      const{data:profile}=await supabaseBrowser.from("profiles").select("role").eq("id",u.id).maybeSingle();
      if(active)setIsAdmin(profile?.role==="admin");
      const{data:seller}=await supabaseBrowser.from("seller_registrations").select("status").eq("user_id",u.id).maybeSingle();
      if(active)setIsVerifiedSeller(seller?.status==="approved");
      const{count}=await supabaseBrowser.from("messages").select("id",{count:"exact",head:true}).eq("receiver_id",u.id).is("read_at",null);
      if(active)setUnread((count||0)>0);
    };
    load();
    const{data:{subscription}}=supabaseBrowser.auth.onAuthStateChange((_event,session)=>{
      if(active)setUser(session?.user||null);
      if(!session&&active)setUnread(false);
    });
    const timer=window.setInterval(load,10000);
    return()=>{active=false;window.clearInterval(timer);subscription.unsubscribe()};
  },[]);

  async function signout(){
    await supabaseBrowser.auth.signOut();
    window.location.href=window.location.hostname.endsWith("github.io")?window.location.origin+"/cph/":window.location.origin+"/";
  }

  return <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
    <div className="container-page flex h-[64px] items-center gap-2 sm:h-[72px] sm:gap-4">
      <Logo/>
      <nav className="hidden gap-5 text-sm font-bold text-slate-600 lg:flex"><Link href="/">Trang chủ</Link><Link href="/danh-muc">Danh mục</Link><Link href="/khu-vuc">Khu vực</Link></nav>
      <Link href="/tim-kiem" aria-label="Tìm kiếm" className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border lg:hidden"><Search size={18}/></Link>
      <div className="ml-auto hidden items-center gap-1 sm:flex">
        <Link href="/yeu-thich" className="rounded-xl p-2.5 text-slate-600" title="Yêu thích"><Heart size={18}/></Link>
        <Link href="/tin-nhan" className="rounded-xl p-2.5 text-slate-600" title="Tin nhắn"><MessageIcon unread={unread}/></Link>
        {ready&&user ? (
          <>
            {isAdmin&&<Link href="/admin" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-extrabold text-brand-700">Quản trị</Link>}{!isVerifiedSeller&&<Link href="/dang-ky-nha-ban-hang" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-extrabold text-brand-700">Đăng ký nhà bán hàng</Link>}{isVerifiedSeller&&<Link href="/tai-khoan" className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-extrabold text-brand-700" title="Nhà bán hàng đã xác minh">✓ Đã xác minh</Link>}
            <Link href="/tai-khoan" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"><UserRound size={17}/><span className="max-w-28 truncate">{user.user_metadata?.full_name||"Tài khoản"}</span></Link>
            <button onClick={signout} className="rounded-xl p-2.5 text-slate-500" title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18}/></button>
          </>
        ) : ready ? (
          <Link href="/dang-nhap" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"><LogIn size={17}/>Đăng nhập</Link>
         ) : <span className="h-9 w-24"/>}
      </div>
      <Link href="/dang-tin" className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-3 sm:h-auto sm:px-4 sm:py-2.5 text-sm font-bold text-white hover:bg-brand-700" aria-label="Đăng tin"><Plus size={18}/><span className="hidden sm:inline">Đăng tin</span></Link>
    </div>
    {pathname!=="/"&&<div className="border-t bg-white md:hidden"><div className="container-page h-11 flex items-center"><Link href="/" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-slate-600 active:text-brand-700" aria-label="Quay về trang chủ"><ArrowLeft size={17}/>Trang chủ</Link></div></div>}
    <nav aria-label="Điều hướng trên điện thoại" className="mobile-bottom-nav md:hidden">
      {mobileItems.map(({href,label,icon:Icon})=><Link key={href} href={href} className="mobile-nav-item">{href==="/tin-nhan"?<MessageIcon unread={unread}/>:<Icon size={19}/>}<span>{label}</span></Link>)}
    </nav>
  </header>;
}