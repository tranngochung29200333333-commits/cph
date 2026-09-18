import Link from "next/link";
import {LogIn,Plus,Heart,MessageCircle,UserRound,Search,Home} from "lucide-react";
import Logo from "./Logo";

const mobileItems=[
  {href:"/",label:"Trang chủ",icon:Home},
  {href:"/yeu-thich",label:"Yêu thích",icon:Heart},
  {href:"/tin-nhan",label:"Tin nhắn",icon:MessageCircle},
  {href:"/tai-khoan",label:"Tài khoản",icon:UserRound},
  {href:"/dang-nhap",label:"Đăng nhập",icon:LogIn},
];

export default function Header(){
  return <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
    <div className="container-page flex h-[64px] items-center gap-2 sm:h-[72px] sm:gap-4">
      <Logo/>
      <nav className="hidden gap-5 text-sm font-bold text-slate-600 lg:flex">
        <Link href="/">Trang chủ</Link><Link href="/danh-muc">Danh mục</Link><Link href="/khu-vuc">Khu vực</Link>
      </nav>
      <Link href="/tim-kiem" aria-label="Tìm kiếm" className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-xl border lg:hidden"><Search size={18}/></Link>
      <div className="ml-auto hidden items-center gap-1 sm:flex">
        <Link href="/yeu-thich" className="rounded-xl p-2.5 text-slate-600" title="Yêu thích"><Heart size={18}/></Link>
        <Link href="/tin-nhan" className="rounded-xl p-2.5 text-slate-600" title="Tin nhắn"><MessageCircle size={18}/></Link>
        <Link href="/tai-khoan" className="rounded-xl p-2.5 text-slate-600" title="Tài khoản"><UserRound size={18}/></Link>
        <Link href="/dang-nhap" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"><LogIn size={17}/>Đăng nhập</Link>
      </div>
      <Link href="/dang-tin" className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-600 px-3 sm:h-auto sm:px-4 sm:py-2.5 text-sm font-bold text-white hover:bg-brand-700" aria-label="Đăng tin">
        <Plus size={18}/><span className="hidden sm:inline">Đăng tin</span>
      </Link>
    </div>
    <nav aria-label="Điều hướng trên điện thoại" className="mobile-bottom-nav md:hidden">
      {mobileItems.map(({href,label,icon:Icon})=><Link key={href} href={href} className="mobile-nav-item"><Icon size={19}/><span>{label}</span></Link>)}
    </nav>
  </header>
}