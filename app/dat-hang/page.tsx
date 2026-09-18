"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import Header from "../../components/Header";
import AuthGuard from "../../components/AuthGuard";
import {supabaseBrowser} from "../../lib/supabase-browser";
import {MapPin,Navigation} from "lucide-react";
const money=new Intl.NumberFormat("vi-VN");
export default function CheckoutPage(){
 const[cart,setCart]=useState<any[]>([]),[name,setName]=useState(""),[phone,setPhone]=useState(""),[address,setAddress]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[locating,setLocating]=useState(false),[location,setLocation]=useState<{latitude:number;longitude:number;accuracy:number}|null>(null);
 useEffect(()=>{try{setCart(JSON.parse(localStorage.getItem("ptmarket-cart")||"[]"))}catch{};supabaseBrowser.auth.getUser().then(({data})=>{const u=data.user;if(u){setName(u.user_metadata?.full_name||"");setPhone(u.user_metadata?.phone||"")}})},[]);
 const total=cart.reduce((s,i)=>s+(i.price_type==="contact"?0:(i.price||0)*i.quantity),0);
 function getLocation(){
  setError("");
  if(!navigator.geolocation){setError("Trình duyệt không hỗ trợ lấy vị trí.");return}
  setLocating(true);
  navigator.geolocation.getCurrentPosition(
   p=>{setLocation({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});setLocating(false)},
   e=>{setLocating(false);setError(e.code===1?"Bạn chưa cho phép truy cập vị trí. Hãy bấm Cho phép trong thông báo của trình duyệt rồi thử lại.":"Không lấy được vị trí hiện tại. Vui lòng thử lại.");},
   {enableHighAccuracy:true,timeout:15000,maximumAge:30000}
  );
 }
 async function submit(){
  if(!cart.length){setError("Giỏ hàng đang trống.");return}
  if(!name.trim()||!phone.trim()||!address.trim()){setError("Vui lòng nhập đủ họ tên, số điện thoại và địa chỉ.");return}
  setBusy(true);setError("");
  for(const i of cart){
   if(i.price_type==="contact"){setError("Sản phẩm "+i.title+" đang để giá liên hệ, chưa thể đặt online.");setBusy(false);return}
   const{data,error:e}=await supabaseBrowser.functions.invoke("order-actions",{body:{action:"create",listing_id:i.id,quantity:i.quantity,customer_name:name,customer_phone:phone,shipping_address:address,note,latitude:location?.latitude||null,longitude:location?.longitude||null,location_accuracy:location?.accuracy||null}});
   if(e||data?.error){setError(data?.error||e?.message||"Không thể tạo đơn hàng. Vui lòng thử lại.");setBusy(false);return}
  }
  localStorage.removeItem("ptmarket-cart");window.dispatchEvent(new Event("ptmarket-cart-updated"));window.location.href="/don-hang";
 }
 return <AuthGuard><main><Header/><section className="container-page py-8"><div className="mx-auto max-w-2xl card p-6 md:p-8"><Link href="/gio-hang" className="text-sm font-bold text-brand-700">← Quay lại giỏ hàng</Link><h1 className="mt-3 text-3xl font-black">Thông tin đặt hàng</h1><p className="mt-2 text-sm text-slate-500">Thanh toán khi nhận hàng (COD).</p>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 grid gap-4"><label className="text-sm font-bold">Họ và tên<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3"/></label><label className="text-sm font-bold">Số điện thoại<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3"/></label><label className="text-sm font-bold">Địa chỉ nhận hàng<textarea value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border px-3 py-3" placeholder="Số nhà, đường, xã/phường..."/></label>
 <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700"><MapPin size={20}/></div><div className="min-w-0 flex-1"><p className="font-black">Vị trí giao hàng trên bản đồ</p><p className="mt-1 text-xs leading-5 text-slate-600">Cho phép truy cập vị trí để quán giao hàng đúng nơi. Vị trí chỉ được ghi nhận khi bạn bấm nút bên dưới.</p>{location?<p className="mt-2 text-xs font-bold text-brand-700">✓ Đã ghi nhận vị trí · độ chính xác khoảng {Math.round(location.accuracy)} m</p>:<button type="button" onClick={getLocation} disabled={locating} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"><Navigation size={16}/>{locating?"Đang lấy vị trí...":"Cho phép truy cập vị trí để quán giao hàng"}</button>}</div></div>{location&&<a className="mt-3 inline-block text-xs font-bold text-brand-700 underline" target="_blank" rel="noreferrer" href={"https://www.google.com/maps?q="+location.latitude+","+location.longitude}>Xem vị trí trên Google Maps →</a>}</div>
 <label className="text-sm font-bold">Ghi chú<textarea value={note} onChange={e=>setNote(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border px-3 py-3"/></label></div><div className="mt-6 rounded-2xl bg-slate-50 p-4"><p className="font-black">Tổng tiền: <span className="text-brand-700">{money.format(total)} đ</span></p><p className="mt-1 text-xs text-slate-500">{cart.length} sản phẩm trong giỏ. Nếu có nhiều nhà bán hàng, hệ thống tạo đơn riêng theo từng sản phẩm.</p></div><button disabled={busy} onClick={submit} className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-3 font-extrabold text-white disabled:opacity-50">{busy?"Đang tạo đơn...":"Đặt hàng COD"}</button></div></section></main></AuthGuard>
}